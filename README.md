# QKI Path Quote

QKI 链多跳报价、循环路径模拟与浏览器钱包交易工具。Chain ID: `20181205`；Router: `0x3c91FD5247B050A1536F24D012a17a618EEFbfCA`。

## 本地运行

```sh
python3 -m http.server 8080 --directory dist
```

## 功能

- 固定 RPC 测速、链检查和故障切换。
- getAmountsOut 多跳报价、自定义 token、path JSON 导出。
- 储备量模拟、3–6 跳循环路径扫描、gas 成本和净收益筛选。
- 扫描时可输入自定义模拟余额及 allowance；完整 eth_call 仍以链上真实状态为准。
- 连接注入式 EIP-1193 钱包并切换或添加 QKI 网络。
- 自定义授权数量、收款地址、amountOutMin、gas price 和有效期。
- 页面以两个醒目的选项支持 `swapExactTokensForTokens` 和 `swapExactTokensForTokensSupportingFeeOnTransferTokens`。
- 每笔授权与兑换均在钱包中确认。

## 测试

```sh
node test.mjs
node network-test.mjs
node optimizer-test.mjs
node scanner-test.mjs
node wallet-test.mjs
```

## Fee Token

Fee Token 模式使用 Router 的 `swapExactTokensForTokensSupportingFeeOnTransferTokens`。`getAmountsOut` 不包含转账税，因此自动计算的最低输出可能偏高；页面允许手动填写 `amountOutMin`。设置过高会使交易回退。

`dist/` 是可直接部署的源码；根目录为测试。`.openai/hosting.json` 是原站点托管配置。
