# QKI Path Quote

QKI 链多跳报价、循环路径模拟与浏览器钱包交易工具。Chain ID: `20181205`；Router: `0x3c91FD5247B050A1536F24D012a17a618EEFbfCA`。

## 本地运行

```sh
python3 -m http.server 8080 --directory dist
```

打开 http://localhost:8080 。RPC 必须允许浏览器跨域请求且 HTTPS 证书有效。

## 功能

- 固定 RPC 测速、链检查和故障切换。
- getAmountsOut 多跳报价、自定义 token、path JSON 导出。
- 时间戳、deadline 和 BigInt 精度转换。
- 储备量模拟、3–6 跳循环路径扫描、1000 gwei gas 成本和净收益筛选。
- 扫描时可输入自定义模拟余额及 allowance；它们只会收紧资金上限，完整 eth_call 仍以链上真实状态为准。
- 连接注入式 EIP-1193 钱包、切换或添加 QKI 网络。
- 自定义授权数量、交易收款地址、amountOutMin、gas price 和有效期。
- 按发送前最新报价生成 swapExactTokensForTokens 交易；每笔授权与兑换均在钱包中确认。

## 测试

```sh
node test.mjs
node network-test.mjs
node optimizer-test.mjs
node scanner-test.mjs
node wallet-test.mjs
```

## 边界

自定义模拟余额和 allowance 不能替代链上真实资金或授权。钱包交易只有在用户点击并在钱包中确认后发送。交易模拟只说明指定区块状态下的结果，无法保证未来成交或所有 token 行为。转账税等特殊 token 的储备报价可能与实际到账不同。

`dist/` 是可直接部署的源码；根目录为测试。`.openai/hosting.json` 是原站点托管配置。
