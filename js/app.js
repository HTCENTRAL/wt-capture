/**
 * app.js - メインコントローラー
 */
(function () {

  // ---- DOM参照 ----
  const video         = document.getElementById('video');
  const canvas        = document.getElementById('canvas');
  const ctx           = canvas.getContext('2d', { alpha: false });
  const screenSelect  = document.getElementById('screen-select');
  const screenCamera  = document.getElementById('screen-camera');
  const exerciseLabel = document.getElementById('exercise-label');
  const modelStatus   = document.getElementById('model-status');
  const recordTimer   = document.getElementById('record-timer');
  const btnRecord     = document.getElementById('btn-record');
  const btnBack       = document.getElementById('btn-back');

  // ---- 状態 ----
  var currentExercise = null;
  var animationId     = null;
  var isModelReady    = false;
  var frameCount      = 0;
  var lastKeypoints   = null;
  var cameraStarted   = false;

  // ---- ステータス表示 ----
  function setStatus(msg) {
    modelStatus.textContent = msg;
    console.log('[App]', msg);
  }

  // ---- Canvasをスクリーンに合わせる ----
  function fitCanvas() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var cw = canvas.width;
    var ch = canvas.height;
    if (!cw || !ch) return;

    var videoRatio  = cw / ch;
    var screenRatio = vw / vh;
    var w, h;

    if (screenRatio > videoRatio) {
      h = vh; w = vh * videoRatio;
    } else {
      w = vw; h = vw / videoRatio;
    }

    canvas.style.width  = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    canvas.style.left   = Math.round((vw - w) / 2) + 'px';
    canvas.style.top    = Math.round((vh - h) / 2) + 'px';
  }

  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', function () {
    setTimeout(fitCanvas, 400);
  });

  // ---- カメラ起動 ----
  function startCamera() {
    return new Promise(function (resolve) {
      setStatus('カメラ起動中...');

      var constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280, max: 1280 },
          height: { ideal: 720,  max: 720  },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      navigator.mediaDevices.getUserMedia(constraints)
        .then(function (stream) {
          video.srcObject = stream;
          video.onloadedmetadata = function () {
            video.play()
              .then(function () {
                canvas.width  = video.videoWidth  || 1280;
                canvas.height = video.videoHeight || 720;
                fitCanvas();
                cameraStarted = true;
                resolve(true);
              })
              .catch(function (e) {
                setStatus('カメラ再生エラー: ' + e.message);
                resolve(false);
              });
          };
          video.onerror = function () {
            setStatus('カメラ映像エラー');
            resolve(false);
          };
        })
        .catch(function (e) {
          if (e.name === 'NotAllowedError') {
            setStatus('カメラを許可してください（設定 > Safari > カメラ）');
          } else if (e.name === 'NotFoundError') {
            setStatus('カメラが見つかりません');
          } else {
            setStatus('カメラエラー: ' + e.name);
          }
          resolve(false);
        });
    });
  }

  // ---- カメラ停止 ----
  function stopCamera() {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(function (t) { t.stop(); });
      video.srcObject = null;
    }
    cameraStarted = false;
  }

  // ---- アニメーションループ ----
  function loop() {
    animationId = requestAnimationFrame(loop);

    if (!cameraStarted) return;

    // 3フレームに1回だけ推論
    if (isModelReady && frameCount % 3 === 0) {
      PoseDetector.detect(video).then(function (kps) {
        lastKeypoints = kps;
      });
    }
    frameCount++;

    var angles = (isModelReady && lastKeypoints)
      ? AngleCalculator.getAngles(lastKeypoints, currentExercise)
      : null;

    Renderer.drawFrame(
      ctx, video,
      isModelReady ? lastKeypoints : null,
      angles, currentExercise,
      canvas.width, canvas.height
    );
  }

  // ---- 画面切り替え ----
  function showScreen(name) {
    screenSelect.classList.remove('active');
    screenCamera.classList.remove('active');
    document.getElementById('screen-' + name).classList.add('active');
  }

  // ---- エクササイズ名 ----
  var NAMES = {
    squat:     'スクワット',
    deadlift:  'デッドリフト',
    bulgarian: 'ブルガリアンスクワット'
  };

  // ---- エクササイズボタン ----
  document.querySelectorAll('.btn-exercise').forEach(function (btn) {
    btn.addEventListener('click', function () {

      currentExercise = btn.dataset.exercise;
      exerciseLabel.textContent = NAMES[currentExercise];
      frameCount    = 0;
      lastKeypoints = null;

      // カメラ画面に切り替え
      showScreen('camera');

      // ボタンをすぐ「起動中」状態で表示（常に見える）
      btnRecord.textContent = '起動中';
      btnRecord.disabled    = true;
      btnRecord.className   = 'loading';

      // カメラを起動
      startCamera().then(function (ok) {
        if (!ok) {
          // カメラ失敗 → ボタンを「エラー」表示（押せないが見える）
          btnRecord.textContent = 'エラー';
          btnRecord.disabled    = true;
          btnRecord.className   = '';
          return;
        }

        // カメラOK → RECボタン有効化
        loop();
        btnRecord.textContent = 'REC';
        btnRecord.disabled    = false;
        btnRecord.className   = '';

        // AIモデルをバックグラウンドで読み込み（RECには影響しない）
        if (!isModelReady) {
          setStatus('AI読み込み中...');
          PoseDetector.init(function (msg) { setStatus(msg); })
            .then(function (ok2) {
              isModelReady = ok2;
              setStatus(ok2 ? '準備完了（骨格表示ON）' : '録画のみ（骨格なし）');
            })
            .catch(function () {
              setStatus('録画のみ（骨格なし）');
            });
        } else {
          setStatus('準備完了（骨格表示ON）');
        }
      });
    });
  });

  // ---- RECボタン ----
  btnRecord.addEventListener('click', function () {
    if (!Recorder.isRecording()) {
      Recorder.startRecording(canvas, function (time) {
        recordTimer.textContent = time;
      });
      btnRecord.textContent = 'STOP';
      btnRecord.classList.add('recording');
      recordTimer.classList.remove('hidden');
    } else {
      btnRecord.disabled = true;
      Recorder.stopRecording(currentExercise).then(function () {
        btnRecord.textContent = 'REC';
        btnRecord.classList.remove('recording');
        btnRecord.disabled    = false;
        recordTimer.classList.add('hidden');
        recordTimer.textContent = '00:00';
      });
    }
  });

  // ---- 戻るボタン ----
  btnBack.addEventListener('click', function () {
    if (Recorder.isRecording()) {
      if (!confirm('録画中です。停止して戻りますか？')) return;
      Recorder.stopRecording(currentExercise);
    }

    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    stopCamera();
    lastKeypoints = null;

    btnRecord.textContent = 'REC';
    btnRecord.className   = '';
    btnRecord.disabled    = true;
    recordTimer.classList.add('hidden');
    recordTimer.textContent = '00:00';

    showScreen('select');
  });

}());
