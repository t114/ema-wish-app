document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('.wish-input');
    const directionRadios = document.getElementsByName('direction');
    const sizeSlider = document.getElementById('size-slider');
    const colorPicker = document.getElementById('color-picker');
    const downloadBtn = document.getElementById('download-btn');
    const emaImageElement = document.querySelector('.ema-image');

    // 文字の向き変更
    directionRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            input.style.writingMode = e.target.value;
        });
    });

    // 文字サイズ変更
    sizeSlider.addEventListener('input', (e) => {
        input.style.fontSize = `${e.target.value}px`;
    });

    // 文字色変更
    colorPicker.addEventListener('input', (e) => {
        input.style.color = e.target.value;
    });

    // ダウンロード機能（Canvas自前描画）
    downloadBtn.addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) {
            if (!confirm('願い事が書かれていませんが、このまま保存しますか？')) {
                return;
            }
        }

        try {
            downloadBtn.disabled = true;
            downloadBtn.textContent = "画像を生成中...";

            // 1. Canvasの作成
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const naturalWidth = emaImageElement.naturalWidth;
            const naturalHeight = emaImageElement.naturalHeight;
            canvas.width = naturalWidth;
            canvas.height = naturalHeight;

            // 2. 絵馬画像の描画
            ctx.drawImage(emaImageElement, 0, 0);

            // 3. テキスト描画設定
            // 画面上の表示サイズと元画像サイズの比率を計算
            const displayWidth = emaImageElement.clientWidth;
            // 描画が完了していない場合などで0になるのを防ぐ
            const safeDisplayWidth = displayWidth || naturalWidth;
            const scaleFactor = naturalWidth / safeDisplayWidth;

            // ComputedStyleを使って正確なスタイルを取得
            const computedStyle = window.getComputedStyle(input);
            const currentFontSize = parseFloat(computedStyle.fontSize);
            const drawFontSize = currentFontSize * scaleFactor;

            ctx.font = `${drawFontSize}px "Shippori Mincho", serif`;
            ctx.fillStyle = computedStyle.color || '#333333';
            ctx.textBaseline = 'top';

            // エリア計算
            const inputRect = input.getBoundingClientRect();
            const imgRect = emaImageElement.getBoundingClientRect();

            // 画像内での相対位置とサイズ
            const relX = (inputRect.left - imgRect.left) / imgRect.width;
            const relY = (inputRect.top - imgRect.top) / imgRect.height;
            const relW = inputRect.width / imgRect.width;
            const relH = inputRect.height / imgRect.height;

            const targetX = naturalWidth * relX;
            const targetY = naturalHeight * relY;
            const targetW = naturalWidth * relW;
            const targetH = naturalHeight * relH;

            // 描画モード判定
            const isVertical = computedStyle.writingMode === 'vertical-rl';
            const textAlign = computedStyle.textAlign; // center, left(start), right(end)

            if (isVertical) {
                // --- 縦書き描画ロジック ---
                const lines = text.split('\n');
                const lineHeight = drawFontSize * 1.5; // CSSのline-heightに合わせるなら計算が必要だが一旦固定

                // vertical-rl は右から左へ行が進む
                // 開始X位置: ボックスの右端からスタート (パディング等は考慮していないのでギリギリになる)
                // 少し余白を持たせるため、明示的にボックス右端を使う
                // プレビューが「右・上」寄りなら、それに合わせる

                let currentX = targetX + targetW - (lineHeight / 2); // 最初の行の中心X座標 (右端)

                // もしCSSで中央揃え(align-items/justify-content等)されていないなら、
                // テキストブロック全体を中央に寄せるかどうかはCSS次第。
                // ユーザーは「プレビュー通り」と言っている。スタイルシートでは .wish-input は top:55%, left:50%, transform... で配置されている。
                // ボックス自体は中央配置だが、テキストはそのボックスの右端(縦書き)から始まる。
                // なので currentX = targetX + targetW で正解のはず。
                // ただ、文字数が多いとはみ出るので、ボックス内に収まるように開始位置を少し調整する必要があるかも？
                // 一旦「ボックスの右端」基準で描画する。

                lines.forEach(line => {
                    // 各行の文字のY座標計算
                    // text-align: center の場合、行（列）の中で文字が縦方向に中央揃えになる
                    let startY = targetY; // デフォルトは上端

                    if (textAlign === 'center') {
                        const lineWidth = line.length * drawFontSize;
                        startY = targetY + (targetH - lineWidth) / 2;
                    }

                    let currentY = startY;

                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        const metrics = ctx.measureText(char);
                        const charWidth = metrics.width;

                        // 文字の左右中央合わせ（行の幅に対して）
                        const charX = currentX - (charWidth / 2); // ここはフォントサイズ基準ではなく文字幅基準で微調整してもよいが、monospace的配置なら固定幅のほうが綺麗かも
                        // 今回は単純に指定座標への描画
                        const drawX = currentX - (charWidth / 2); // 行の中心線に文字の中心を合わせる

                        ctx.fillText(char, drawX, currentY);
                        currentY += drawFontSize;
                    }
                    currentX -= lineHeight;
                });

            } else {
                // --- 横書き描画ロジック ---
                ctx.textBaseline = 'middle'; // Y方向の計算をしやすくするため
                const lines = text.split('\n');
                const lineHeight = drawFontSize * 1.5;

                // 横書きは上から下へ
                let currentY = targetY + (lineHeight / 2); // 最初の行の中心Y座標 (上端)

                // CSSでは vertical-align 的なプロパティがない限り上詰め
                // もしボックス内で上下中央揃えしたいならCSSを確認する必要があるが、
                // input/textareaは通常上詰め。

                // ただしCSSで .wish-input は text-align: center なので水平方向は中央揃え

                lines.forEach(line => {
                    let startX = targetX; // 左端

                    if (textAlign === 'center') {
                        startX = targetX + (targetW / 2);
                        ctx.textAlign = 'center';
                    } else if (textAlign === 'right') {
                        startX = targetX + targetW;
                        ctx.textAlign = 'right';
                    } else {
                        ctx.textAlign = 'left';
                    }

                    ctx.fillText(line, startX, currentY);
                    currentY += lineHeight;
                });
            }

            // 5. 画像生成とダウンロード
            const dataUrl = canvas.toDataURL('image/png');
            const filename = `ema_wish_${new Date().getTime()}.png`;

            const link = document.createElement('a');
            link.download = filename;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // フォールバック
            setTimeout(() => {
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                    const msg = document.createElement('div');
                    msg.innerHTML = `
                        <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:white; text-align:center; padding:20px;">
                            <p>画像が保存されましたか？<br>もし保存されていない場合は、<br>以下の画像を長押しして保存してください。</p>
                            <img src="${dataUrl}" style="max-width:80%; max-height:60%; border:2px solid white; margin:10px 0;">
                            <button onclick="this.parentElement.remove()" style="padding:10px 20px; background:#fff; color:#333; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">閉じる</button>
                        </div>
                     `;
                    document.body.appendChild(msg);
                }
            }, 1000);

        } catch (err) {
            console.error('保存に失敗しました:', err);
            alert('画像の保存中にエラーが発生しました:\n' + err.message);
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = "絵馬を保存する";
        }
    });
});
