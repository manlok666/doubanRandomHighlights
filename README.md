# Douban Random Highlights

输入豆瓣 ID，读取公开的「想看」电影列表，点击按钮随机抽取一部并展示：

- 海报
- 简介
- 豆瓣评分
- 评分人数
- 豆瓣详情页链接

## 技术栈

- Next.js 16（App Router）
- React 19
- TypeScript
- Tailwind CSS 4
- Cheerio（服务端解析豆瓣页面）

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 构建与检查

```bash
npm run lint
npm run build
```

## 使用说明

1. 在页面输入豆瓣 ID（用户主页 URL 中 `/people/{id}/` 的 `{id}`）
2. 点击「开始随机」，页面会显示实时进度条和当前工作流程
3. 系统会先随机选择该用户想看列表中的一页，再从该页随机抽取一部电影并展示详情
4. 可重复点击继续随机

## 注意事项

- 仅能读取公开可访问的想看列表
- 若豆瓣访问受限或出现反爬策略，接口可能返回失败
- 数据来自实时抓取，受豆瓣页面结构变化影响

## 可选环境变量

- `DOUBAN_RANDOM_PAGE_RETRY_MAX`：随机页为空时的最大重试次数，默认 `4`，范围 `1-10`
- `DOUBAN_RETRY_MAX`：电影详情抓取遇到反爬时的最大重试次数，默认 `3`，范围 `1-8`
- `DOUBAN_RETRY_BASE_DELAY_MS`：重试基础退避时间（毫秒），默认 `800`，范围 `100-10000`

示例（Windows `cmd`）：

```bat
set DOUBAN_RANDOM_PAGE_RETRY_MAX=5
set DOUBAN_RETRY_MAX=5
set DOUBAN_RETRY_BASE_DELAY_MS=1200
npm run dev
```

