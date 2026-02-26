/**
 * pose-detector.js - MoveNet ラッパー
 */
var PoseDetector = (function () {

  var detector = null;

  var KP = {
    NOSE: 0,
    LEFT_EYE: 1,   RIGHT_EYE: 2,
    LEFT_EAR: 3,   RIGHT_EAR: 4,
    LEFT_SHOULDER: 5,  RIGHT_SHOULDER: 6,
    LEFT_ELBOW: 7,     RIGHT_ELBOW: 8,
    LEFT_WRIST: 9,     RIGHT_WRIST: 10,
    LEFT_HIP: 11,      RIGHT_HIP: 12,
    LEFT_KNEE: 13,     RIGHT_KNEE: 14,
    LEFT_ANKLE: 15,    RIGHT_ANKLE: 16
  };

  function init(onStatus) {
    return new Promise(function (resolve) {
      onStatus('WebGL初期化中...');

      tf.setBackend('webgl')
        .then(function () { return tf.ready(); })
        .then(function () {
          onStatus('MoveNetモデル読み込み中...');
          return poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            { modelType: 'SinglePose.Lightning' }
          );
        })
        .then(function (d) {
          detector = d;
          onStatus('モデル準備完了');
          resolve(true);
        })
        .catch(function (e) {
          console.error('PoseDetector error:', e);
          onStatus('モデルエラー: ' + e.message);
          resolve(false);
        });
    });
  }

  function detect(videoEl) {
    if (!detector) return Promise.resolve(null);
    if (videoEl.readyState < 2) return Promise.resolve(null);

    return detector.estimatePoses(videoEl, { flipHorizontal: false })
      .then(function (poses) {
        if (!poses || poses.length === 0) return null;
        return poses[0].keypoints;
      })
      .catch(function () { return null; });
  }

  return { init: init, detect: detect, KP: KP };
}());
