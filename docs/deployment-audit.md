# 部署改造执行记录

## 已执行

1. 已备份 SQLite：
   `C:\Users\haona\OneDrive\Desktop\仓库运营管理系统\backups\warehouse-20260620-072228.sqlite`
2. 已备份当前源码：
   `C:\Users\haona\OneDrive\Desktop\仓库运营管理系统\backups\source-before-supabase-20260620-072244`

## Git 分支状态

当前机器未找到 `git` 命令，因此无法创建真实 Git 分支。为避免破坏现有可运行版本，已创建 SQLite 和源码备份。

## 拟修改文件

- `package.json`
- `.gitignore`
- `.env.example`
- `README.md`
- `supabase/migrations/001_initial_schema.sql`
- `src/lib/*`
- `src/app/page.tsx`
- `src/app/api/**`

## 不执行事项

- 不创建真实 Supabase 服务
- 不部署 Vercel
- 不删除 SQLite
- 不写入真实邮箱、密码或密钥
