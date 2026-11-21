# Model Evidence Labs · 图像与模型交互实验

三个无需构建的浏览器实验。先做预测，再改变一个条件，用真实计算结果验证猜测。

- [背景捷径](https://chenyueqi2024.github.io/model-evidence-labs/) · 同一个形状只换背景。改变训练集中形状与背景的搭配比例，在固定的四组测试图片上对比两次训练。
- [置信度校准](https://chenyueqi2024.github.io/model-evidence-labs/calibration/) · 从上一站的入口进入时，按同一数据比例和随机种子重建相同分类器。揭晓置信度档的实际正确率，尝试独立验证集拟合的温度，并切换测试分布。
- [傅里叶图像](https://chenyueqi2024.github.io/model-evidence-labs/fourier/) · 交换两幅图的幅度、相位并重建，拖动滑块验证循环平移的频域性质。预设建筑与枫叶为生成的照片风格样图，也可在浏览器里选取自己的图片。

## 复现

在仓库根目录运行 `python -m http.server 8000`，打开 `http://localhost:8000/`。数值测试使用 `npm test`，需要 Node.js 20 或更新版本。计算、训练和图片读取在浏览器本地完成。

训练、验证、测试数据使用独立固定种子，各含 400 个合成样本。小型 CNN 使用可训练卷积与二分类交叉熵，训练由后台线程执行。傅里叶实验使用二维 FFT 和逆 FFT，合成结果使用共同的显示范围。页面给出公式、边界和文献链接。

- [Geirhos 等，Shortcut Learning in Deep Neural Networks](https://arxiv.org/abs/2004.07780)
- [Sagawa 等，Distributionally Robust Neural Networks for Group Shifts](https://arxiv.org/abs/1911.08731)
- [Guo 等，On Calibration of Modern Neural Networks](https://proceedings.mlr.press/v70/guo17a.html)
- [Oppenheim 与 Lim，The Importance of Phase in Signals](https://dsp-group.mit.edu/wp-content/uploads/2024/11/ImportancePhaseSignals_1981.pdf)

代码采用 MIT 许可。
