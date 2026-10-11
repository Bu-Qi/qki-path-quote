# QKI Path Quote

QKI 链只读多跳报价与循环路径模拟工具。Chain ID: `20181205`；Router: `0x3c91FD5247B050A1536F24D012a17a618EEFbfCA`。

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
- 固定 1000 gwei 估算 gas 成本，筛选估算净收益为正的结果，导出 CSV/JSON。

## 测试

```sh
node test.mjs
node network-test.mjs
node optimizer-test.mjs
node scanner-test.mjs
```

## 计算边界

本项目不签名、不发送交易、不管理私钥。交易模拟只说明指定区块状态下的调用结果，无法保证未来成交或所有 token 行为。扫描输入优化目标是毛利，结果再扣除 gas；不保证净收益全局最优。非 WQKI 本位的 gas 按快照内报价折算。储备模型采用每跳 997/1000 系数，仅适用于匹配的池模型；转账税等特殊 token 的储备报价可能与实际到账不同。测试使用本地逻辑和模拟 RPC，不等于实际链上交易验证。

## 源码

`dist/` 是可直接部署的源码（不是压缩产物）；根目录为测试。`.openai/hosting.json` 是原站点的托管配置，独立静态部署不需要此文件。
