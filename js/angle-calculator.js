/**
 * angle-calculator.js
 * 関節角度の計算モジュール
 */
const AngleCalculator = (() => {

  // ---- 基本数学 ----

  /**
   * 3点ベクトル法：B点での角度を計算（0〜180度）
   * A---B---C の形で、B点での開き角度を返す
   */
  function angleBetween(A, B, C) {
    if (!A || !B || !C) return null;
    const BAx = A.x - B.x, BAy = A.y - B.y;
    const BCx = C.x - B.x, BCy = C.y - B.y;
    const dot = BAx * BCx + BAy * BCy;
    const magBA = Math.sqrt(BAx * BAx + BAy * BAy);
    const magBC = Math.sqrt(BCx * BCx + BCy * BCy);
    if (magBA < 1e-6 || magBC < 1e-6) return null;
    const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
    return Math.round(Math.acos(cos) * (180 / Math.PI));
  }

  /**
   * 垂直からの傾き角度（0〜90度）
   * A→B のベクトルが垂直方向からどれだけ傾いているか
   */
  function angleFromVertical(A, B) {
    if (!A || !B) return null;
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag < 1e-6) return null;
    // 垂直参照ベクトル: スクリーン座標では下方向が(0,1)
    const cos = Math.abs(dy) / mag;
    return Math.round(Math.acos(Math.min(1, cos)) * (180 / Math.PI));
  }

  // ---- キーポイント取得 ----

  const MIN_SCORE = 0.3;

  function kp(keypoints, index) {
    const point = keypoints[index];
    return (point && point.score >= MIN_SCORE) ? point : null;
  }

  function avg(a, b) {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: 1 };
  }

  // ---- エクササイズ別角度抽出 ----

  function getSquatAngles(keypoints) {
    const lSho = kp(keypoints, 5),  rSho = kp(keypoints, 6);
    const lHip = kp(keypoints, 11), rHip = kp(keypoints, 12);
    const lKne = kp(keypoints, 13), rKne = kp(keypoints, 14);
    const lAnk = kp(keypoints, 15), rAnk = kp(keypoints, 16);

    const midSho = avg(lSho, rSho);
    const midHip = avg(lHip, rHip);

    return {
      leftKnee:  { value: angleBetween(lHip, lKne, lAnk),  label: 'L膝',  pos: lKne,   key: 'leftKnee' },
      rightKnee: { value: angleBetween(rHip, rKne, rAnk),  label: 'R膝',  pos: rKne,   key: 'rightKnee' },
      hip:       { value: angleBetween(midSho, midHip, avg(lKne, rKne)), label: '股関節', pos: midHip, key: 'hip' },
      back:      { value: angleFromVertical(midHip, midSho), label: '背中',  pos: midSho, key: 'back' },
    };
  }

  function getDeadliftAngles(keypoints) {
    const lSho = kp(keypoints, 5),  rSho = kp(keypoints, 6);
    const lHip = kp(keypoints, 11), rHip = kp(keypoints, 12);
    const lKne = kp(keypoints, 13), rKne = kp(keypoints, 14);
    const lAnk = kp(keypoints, 15), rAnk = kp(keypoints, 16);

    const midSho = avg(lSho, rSho);
    const midHip = avg(lHip, rHip);
    const midKne = avg(lKne, rKne);
    const midAnk = avg(lAnk, rAnk);

    return {
      hipHinge: { value: angleBetween(midSho, midHip, midKne), label: '股関節', pos: midHip, key: 'hipHinge' },
      knee:     { value: angleBetween(midHip, midKne, midAnk),  label: '膝',    pos: midKne, key: 'knee' },
      back:     { value: angleFromVertical(midHip, midSho),      label: '背中',  pos: midSho, key: 'back' },
    };
  }

  function getBulgarianAngles(keypoints) {
    const lSho = kp(keypoints, 5),  rSho = kp(keypoints, 6);
    const lHip = kp(keypoints, 11), rHip = kp(keypoints, 12);
    const lKne = kp(keypoints, 13), rKne = kp(keypoints, 14);
    const lAnk = kp(keypoints, 15), rAnk = kp(keypoints, 16);

    const midSho = avg(lSho, rSho);
    const midHip = avg(lHip, rHip);

    return {
      frontKnee: { value: angleBetween(lHip, lKne, lAnk),  label: '前膝',  pos: lKne,   key: 'frontKnee' },
      rearKnee:  { value: angleBetween(rHip, rKne, rAnk),  label: '後膝',  pos: rKne,   key: 'rearKnee' },
      hip:       { value: angleBetween(midSho, midHip, lKne), label: '股関節', pos: midHip, key: 'hip' },
      torso:     { value: angleFromVertical(midHip, midSho), label: '体幹',  pos: midSho, key: 'torso' },
    };
  }

  // ---- 適正範囲（色分け用） ----
  // green: 適正, yellow: 注意, それ以外: 範囲外(赤)

  const RANGES = {
    squat: {
      leftKnee:  { green: [75, 115],  yellow: [60, 135] },
      rightKnee: { green: [75, 115],  yellow: [60, 135] },
      hip:       { green: [75, 115],  yellow: [60, 130] },
      back:      { green: [0, 30],    yellow: [0, 45] },
    },
    deadlift: {
      hipHinge: { green: [55, 95],   yellow: [40, 115] },
      knee:     { green: [135, 170], yellow: [115, 170] },
      back:     { green: [0, 25],    yellow: [0, 40] },
    },
    bulgarian: {
      frontKnee: { green: [75, 115],  yellow: [60, 135] },
      rearKnee:  { green: [75, 120],  yellow: [55, 135] },
      hip:       { green: [75, 115],  yellow: [60, 130] },
      torso:     { green: [0, 20],    yellow: [0, 35] },
    },
  };

  function getColor(exercise, key, value) {
    if (value === null) return '#888888';
    const r = RANGES[exercise]?.[key];
    if (!r) return '#ffffff';
    if (value >= r.green[0] && value <= r.green[1]) return '#2ecc71';
    if (value >= r.yellow[0] && value <= r.yellow[1]) return '#f39c12';
    return '#e74c3c';
  }

  // ---- 公開API ----

  function getAngles(keypoints, exercise) {
    switch (exercise) {
      case 'squat':     return getSquatAngles(keypoints);
      case 'deadlift':  return getDeadliftAngles(keypoints);
      case 'bulgarian': return getBulgarianAngles(keypoints);
      default: return {};
    }
  }

  return { getAngles, getColor };
})();
