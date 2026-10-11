# QKI Path Quote

QKI 链多跳报价、循环路径模拟与浏览器钱包交易工具。Chain ID: `20181205`；Router: `0x3c91FD5247B050A1536F24D012a17a618EEFbfCA`。

## 本地运行

无需安装依赖或构建，使用静态服务器运行：

```sh
python3 -m http.server 8080 --directory dist
```

打开 http://localhost:8080 。RPC 必须允许浏览器跨域请求且 HTTPS 证书有效。

## 功能

- 固定 RPC 列表测速、链检查和故障切换。
- getAmountsOut 多跳报价、常用及自定义 token、path JSON 导出。
- 时间戳、deadline 和 BigInt 精度转换。
- 储备量模拟、循环路径输入数量优化、3–6 跳扫描。
- 按指定地址当前余额和 allowance 执行 eth_call 与 eth_estimateGas。
- 固定 1000 gwei 估算 gas 成本，筛选预计净收益为正的结果，导出 CSV/JSON。
- 连接注入式 EIP-1193 钱包、切换或添加 QKI 网络、精确授权当前 amountIn。
- 按发送前最新报价、滑点和有效期生成 swapExactTokensForTokens 交易；每笔授权与兑换均在钱包中确认。

## 测试

```sh
node test.mjs
node network-test.mjs
node optimizer-test.mjs
node scanner-test.mjs
node wallet-test.mjs
```

## 计算与交易边界

扫描和模拟不签名、不发送交易。钱包交易功能仅在用户点击并在钱包中确认后发送。交易模拟只说明指定区块状态下的调用结果，无法保证未来成交或所有 token 行为。扫描输入优化目标是毛利，结果再扣除 gas；不保证净收益全局最优。储备模型采用每跳 997/1000 系数，仅适用于匹配的池模型；转账税等特殊 token 的储备报价可能与实际到账不同。授权默认只覆盖当前 amountIn。兑换交易 gas price 固定为 1000 gwei。

## 源码

`dist/` 是可直接部署的源码；根目录为测试。`.openai/hosting.json` 是原站点托管配置，独立静态部署不需要此文件。
