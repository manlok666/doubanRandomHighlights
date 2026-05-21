# Douban Random Highlights

输入豆瓣 ID，读取公开的「想看」电影列表，点击按钮随机抽取一部并展示：

- 海报
- 简介
- 豆瓣评分
- 评分人数
- 热评
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
2. 点击「加载列表」获取该用户公开的想看电影，并立即随机展示一部电影详情
3. 点击「开始随机」继续随机展示其他电影详情

## 注意事项

- 仅能读取公开可访问的想看列表
- 若豆瓣访问受限或出现反爬策略，接口可能返回失败
- 数据来自实时抓取，受豆瓣页面结构变化影响
