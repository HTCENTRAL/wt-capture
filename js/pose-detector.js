/**
 * pose-detector.js
 * MoveNet SINGLEPOSE_LIGHTNING ラッパー
 */
const PoseDetector = (() => {

  let detector = null;

  // キーポイントインデックス定数
  const KP = {
    NOSE: 0,
    LEFT_EYE: 1,   RIGHT_EYE: 2,
    LEFT_EAR: 3,   RIGHT_EAR: 4,
    LEFT_SHOULDER: 5,  RIGHT_SHOULDER: 6,
    LEFT_ELBOW: 7,     RIGHT_ELBOW: 8,
    LEFT_WRIST: 9,     RIGHT_WRIST: 10,
    LEFT_HIP: 11,      RIGHT_HIP: 12,
    LEFT_KNEE: 13,     RIGHT_KNEE: 14,
    LEFT_ANKLE: 15,    RIGHT_ANKLE: 16,
  };

  /**
   * モデルを初期化する
   * @param {Function} onStatus - ステータス文字列を受け取るコールバック
   */
  async function init(onStatus) {
    try {
      onStatus('WebGLバックエンド初期化中...');
      await tf.setBackend('webgl');
      await tf.ready();

      onStatus('MoveNetモデル読み込み中...');
      detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          // LIGHTNING: 最軽量・最速（モバイル向け）
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        }
      );

      onStatus('準備完了');
      return true;
    } catch (err) {
      onStatus(`エラー: ${err.message}`);
      console.error('PoseDetector init error:', err);
      return false;
    }
  }

  /**
   * ビデオ要素から姿勢を推定する
   * @param {HTMLVideoElement} videoEl
   * @returns {Array|null} 17要素のキーポイント配列、検出できない場合はnull
   */
  async function detect(videoEl) {
    if (!detector) return null;
    // ビデオがまだ準備できていない場合はスキップ
    if (videoEl.readyState < 2) return null;

    try {
      const poses = await detector.estimatePoses(videoEl, {
        flipHorizontal: false,
      });
      if (!poses || poses.length === 0) return null;
      return poses[0].keypoints;
    } catch (err) {
      // 検出エラーは静かに無視（フレーム単位の失敗は正常）
      return null;
    }
  }

  return { init, detect, KP };
})();
