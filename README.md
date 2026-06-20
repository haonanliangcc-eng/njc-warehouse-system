# NJC仓运营数据中心

Next.js + TypeScript + Tailwind CSS 的仓库运营管理系统。第一阶段云端改造目标：

- Vercel 部署 Next.js
- Supabase PostgreSQL 保存业务数据
- Supabase Auth 邮箱密码登录
- Supabase Storage 保存异常照片、签名图片和附件
- Supabase Row Level Security 做数据库权限兜底

## 本地开发

```powershell
npm install
copy .env.example .env.local
npm run dev
```

`.env.local` 需要填写 Supabase 项目参数。不要提交真实密钥。

## Supabase 初始化

1. 在 Supabase 创建新项目。
2. 打开 SQL Editor。
3. 执行 `supabase/migrations/001_initial_schema.sql`。
4. 在 Authentication > Users 创建第一个用户。
5. 复制该用户的 `id`。
6. 在 SQL Editor 运行 migration 文件末尾注释里的 `profiles` 插入语句，将该用户设置为 `admin`。
7. 在 Vercel 环境变量中填写 `.env.example` 中的变量。

## 权限模型

- `admin`：管理用户、查看、创建、修改、删除全部业务数据。
- `supervisor`：创建和修改日报、任务、异常、交接和签字，不能管理用户。
- `viewer`：只能查看历史记录、仪表盘和导出文件。

权限同时在 Next.js API Route 和 Supabase RLS 校验。前端隐藏按钮只是体验优化，不作为安全边界。

## 文件存储

Supabase Storage bucket：`warehouse-files`

建议路径：

```text
reports/{report_id}/incidents/{incident_id}/{uuid}.{extension}
```

限制：

- 最大 10 MB
- 仅允许 jpg、jpeg、png、webp
- bucket 为 private
- 查看时通过 signed URL

## 部署到 Vercel

1. 将项目推送到 GitHub。
2. Vercel 导入 GitHub 仓库。
3. 添加环境变量。
4. 部署。

不要在 Vercel 中使用 SQLite 文件作为生产数据库。

## 测试清单

- 未登录访问页面应显示登录页。
- viewer 登录后不能看到保存、上传、删除、用户管理入口。
- viewer 直接调用写入 API 应返回 403。
- supervisor 可以创建和修改日报。
- supervisor 不能访问用户管理 API。
- admin 可以创建/修改用户 profile。
- 保存日报时提交旧 version 应返回 409。
- 上传非图片应失败。
- 上传超过 10 MB 应失败。
- 删除异常时应同步删除照片对象和数据库记录。
- 钉钉 webhook 不应出现在浏览器代码中。
- `npm run lint` 通过。
- `npm run build` 通过。
