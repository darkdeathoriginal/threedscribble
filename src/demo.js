export const makeDemoImage = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 520;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sky = ctx.createLinearGradient(0, 0, 520, 520);
  sky.addColorStop(0, '#ffffff');
  sky.addColorStop(1, '#ffffff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 520, 520);

  // A self-contained illustrated source, with colored cloth, highlights and
  // fine hair/eye features to make the different strand controls visible.
  const jacket = ctx.createLinearGradient(100, 350, 410, 470);
  jacket.addColorStop(0, '#561e35');
  jacket.addColorStop(0.42, '#ed443d');
  jacket.addColorStop(0.7, '#ac2139');
  jacket.addColorStop(1, '#292c4b');
  ctx.fillStyle = jacket;
  ctx.beginPath();
  ctx.moveTo(70, 480);
  ctx.bezierCurveTo(90, 370, 146, 370, 222, 349);
  ctx.lineTo(297, 346);
  ctx.bezierCurveTo(385, 366, 420, 390, 451, 480);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f18b6c';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(110 + i * 7, 390 - i * 2);
    ctx.bezierCurveTo(140 + i * 8, 413, 110 + i * 10, 448, 102 + i * 12, 479);
    ctx.stroke();
  }
  ctx.fillStyle = '#bd7c66';
  ctx.beginPath();
  ctx.moveTo(225, 331); ctx.lineTo(224, 372); ctx.quadraticCurveTo(265, 409, 299, 370); ctx.lineTo(295, 327); ctx.fill();

  ctx.fillStyle = '#1d2324';
  ctx.beginPath();
  ctx.ellipse(260, 232, 116, 124, 0.04, 0, Math.PI * 2);
  ctx.fill();

  const skin = ctx.createRadialGradient(234, 248, 8, 273, 280, 102);
  skin.addColorStop(0, '#ffdbc0');
  skin.addColorStop(0.55, '#efb895');
  skin.addColorStop(1, '#ae6c59');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(260, 270, 82, 106, 0.02, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2c3434';
  ctx.beginPath();
  ctx.ellipse(224, 258, 16, 7, 0.08, 0, Math.PI * 2);
  ctx.ellipse(298, 258, 16, 7, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff4de';
  ctx.beginPath();
  ctx.ellipse(224, 258, 13, 4.5, 0.08, 0, Math.PI * 2);
  ctx.ellipse(298, 258, 13, 4.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#46635a';
  ctx.beginPath();
  ctx.arc(225, 258, 5, 0, Math.PI * 2); ctx.arc(297, 258, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#19252b';
  ctx.beginPath();
  ctx.arc(225, 258, 2.8, 0, Math.PI * 2); ctx.arc(297, 258, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4c332e'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(207, 241); ctx.quadraticCurveTo(224, 233, 241, 241);
  ctx.moveTo(283, 241); ctx.quadraticCurveTo(299, 233, 316, 241); ctx.stroke();

  ctx.strokeStyle = '#6f3c43';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(236, 322);
  ctx.bezierCurveTo(250, 330, 275, 330, 288, 321);
  ctx.stroke();

  ctx.strokeStyle = '#c18770';
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(258, 272);
  ctx.bezierCurveTo(246, 296, 248, 306, 264, 308);
  ctx.stroke();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#6f3c43';
  ctx.beginPath();
  ctx.ellipse(218, 294, 26, 14, -0.2, 0, Math.PI * 2);
  ctx.ellipse(306, 294, 26, 14, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Swept hair with individual warm highlights.
  ctx.fillStyle = '#25252c';
  ctx.beginPath();
  ctx.moveTo(167, 247); ctx.bezierCurveTo(152, 163, 209, 104, 291, 124);
  ctx.bezierCurveTo(370, 140, 381, 206, 342, 271);
  ctx.bezierCurveTo(327, 203, 310, 167, 290, 166);
  ctx.bezierCurveTo(261, 217, 202, 178, 167, 247); ctx.fill();
  for (let i = 0; i < 85; i++) {
    const t = i / 85;
    ctx.strokeStyle = i % 3 === 0 ? '#756255' : '#3a3738';
    ctx.lineWidth = 0.7 + (i % 4) * 0.25;
    ctx.beginPath();
    ctx.moveTo(169 + t * 18, 239 - t * 62);
    ctx.bezierCurveTo(196 + t * 16, 128 + t * 34, 252 + t * 35, 116 + t * 40, 296 + t * 38, 154 + t * 56);
    ctx.stroke();
  }
  ctx.strokeStyle = '#222838'; ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(215, 367); ctx.lineTo(251, 407); ctx.lineTo(265, 480);
  ctx.moveTo(308, 365); ctx.lineTo(275, 407); ctx.stroke();
  ctx.strokeStyle = '#ffb38d'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(260, 407); ctx.lineTo(276, 480); ctx.stroke();

  return canvas.toDataURL('image/png');
};

