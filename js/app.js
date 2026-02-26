/**
 * app.js
 * アプリ全体の制御・カメラ初期化・アニメーションループ
 */
(async () => {

  // ---- DOM参照 ----
  const video         = document.getElementById('video');
  const canvas        = document.getElementById('canvas');
  const ctx           = canvas.getContext('2d', { alpha: false }); // alpha:false で高速化
  const screenSelect  = document.getElementById('screen-select');
  const screenCamera  = document.getElementById('screen-camera');
  const exerciseLabel = document.getElementById('exercise-label');
  const modelStatus   = document.getElementById('model-status');
  const recordTimer   = document.getElementById('record-timer');
  const btnRecord     = document.getElementById('btn-record');
  const btnBack       = document.getElementById('btn-back');

  // ---- 状態 ----
  let currentExercise = null;
  let animationId     = null;
  let isModelReady    = false;
  let frameCount      = 0;
  let lastKeypoints   = null;

  // ---- カメラ初期化 ----
  async function startCamera() {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' }, // 後カメラ優先
        width:  { ideal: 1280, max: 1280 },
        height: { ideal: 720,  max: 720  },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
      await video.play();

      // Canvasサイズをビデオの実際の解像度に合わせる
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;

      return true;
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'カメラの使用を許可してください。\nSafariの設定 > カメラ で許可できます。'
        : `カメラエラー: ${err.message}`;
      alert(msg);
      return false;
    }
  }

  // ---- カメラ停止 ----
  function stopCamera() {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    }
  }

  // ---- 軽量アニメーションループ ----
  // 30fps でレンダリング、3フレームに1回（約10fps）だけ推論
  function animationLoop() {
    animationId = requestAnimationFrame(animationLoop);

    // 推論は3フレームに1回のみ（awaitを使わず非同期で流す）
    if (frameCount % 3 === 0) {
      PoseDetector.detect(video).then(kps => {
        lastKeypoints = kps;
      });
    }
    frameCount++;

    // 毎フレームレンダリング（前フレームのキーポイントを使い回す）
    const angles = lastKeypoints
      ? AngleCalculator.getAngles(lastKeypoints, currentExercise)
      : null;

    Renderer.drawFrame(
      ctx, video, lastKeypoints, angles, currentExercise,
      canvas.width, canvas.height
    );
  }

  // ---- 画面切り替え ----
  function showScreen(name) {
    screenSelect.classList.remove('active');
    screenCamera.classList.remove('active');
    if (name === 'select') screenSelect.classList.add('active');
    if (name === 'camera') screenCamera.classList.add('active');
  }

  // ---- エクササイズボタン ----
  const EXERCISE_NAMES = {
    squat:     'スクワット',
    deadlift:  'デッドリフト',
    bulgarian: 'ブルガリアンスクワット',
  };

  document.querySelectorAll('.btn-exercise').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentExercise = btn.dataset.exercise;
      exerciseLabel.textContent = EXERCISE_NAMES[currentExercise];
      frameCount = 0;
      lastKeypoints = null;
      showScreen('camera');

      // カメラとモデル初期化を並列実行
      const [cameraOk] = await Promise.all([
        startCamera(),
        isModelReady
          ? Promise.resolve(true)
          : PoseDetector.init(msg => { modelStatus.textContent = msg; })
            .then(ok => { isModelReady = ok; return ok; }),
      ]);

      if (cameraOk && isModelReady) {
        modelStatus.textContent = '準備完了';
        btnRecord.disabled = false;
        animationLoop();
      }
    });
  });

  // ---- RECボタン ----
  btnRecord.addEventListener('click', async () => {
    if (!Recorder.isRecording()) {
      // 録画開始
      Recorder.startRecording(canvas, (time) => {
        recordTimer.textContent = time;
      });
      btnRecord.textContent = 'STOP';
      btnRecord.classList.add('recording');
      recordTimer.classList.remove('hidden');
    } else {
      // 録画停止
      btnRecord.disabled = true;
      await Recorder.stopRecording(currentExercise);
      btnRecord.textContent = 'REC';
      btnRecord.classList.remove('recording');
      btnRecord.disabled = false;
      recordTimer.classList.add('hidden');
      recordTimer.textContent = '00:00';
    }
  });

  // ---- 戻るボタン ----
  btnBack.addEventListener('click', async () => {
    if (Recorder.isRecording()) {
      if (!confirm('録画中です。停止して戻りますか？')) return;
      await Recorder.stopRecording(currentExercise);
    }

    // アニメーション停止
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    stopCamera();

    // ボタン状態リセット
    btnRecord.textContent = 'REC';
    btnRecord.classList.remove('recording');
    btnRecord.disabled = true;
    recordTimer.classList.add('hidden');
    recordTimer.textContent = '00:00';
    lastKeypoints = null;

    showScreen('select');
  });

})();
