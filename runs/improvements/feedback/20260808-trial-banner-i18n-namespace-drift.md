# 20260808 TrialBanner i18n namespace drift

## 背景

在 TrialBanner 功能实作中，需要加入试用-banner 的翻
译。用户在 dashboard 看到原始 key（`trialBanner.title`）而非翻译中文。

## 根因

**不是**翻译文件写错，而是 i18n namespace 对齐错误：

1. `TrialBanner.tsx` 在 `components/business/dashboard/` 下
2. 但翻译 key 错误地加入 `auth.zh-TW.json`（auth namespace）
3. `auth.zh-TW.json` 是 flat JSON 格式，无法支持 `t('dashboard.trialBanner.title')` 这样的 nested path
4. 后续追加 `dashboard` block 到 auth.json，但这只是文件内的 nested object，i18n 的 flat key 解析方式不认

**核心问题**：新增 i18n key 时没有先检查现有 namespace 结构，凭直觉加到了 auth namespace。

## 修法（这次做了什么）

1. 创建独立的 `dashboard.zh-TW.json` + `dashboard.en.json`（dashboard namespace）
2. `TrialBanner.tsx` 改用 `useTranslation('dashboard')`
3. `i18n/index.ts` 加入 dashboard namespace 载入
4. 从 `auth.zh-TW.json` / `auth.en.json` 移除多余的 dashboard block

## 学习

**i18n namespace 拆分规则**：
- Feature 相关的翻译必须独立 namespace 文件
- namespace 应与组件文件路径对齐
  - `components/business/dashboard/TrialBanner/` → `dashboard` namespace
  - `components/business/auth/LoginForm/` → `auth` namespace
- 新增 i18n key 前先检查：
  1. `i18n/index.ts` 有哪些 namespace
  2. 该 feature 的组件文件在哪
  3. 对齐后再加 key

**Flat JSON vs Nested JSON**：
- i18next flat JSON 格式中 `t('a.b.c')` 查找的是 key `"a.b.c"`（dot 作为 key 名的一部分）
- 而非 nested object `{"a": {"b": {"c": "value"}}}`
- 要用 nested key path 必须确保 namespace 文件本身是 nested object，或直接用 flat key

**下次怎么预防**：
- 在 `TrialBanner.tsx` 写完后立即检查 i18n，而不是之后补
- 新增 i18n key 前先跑 `grep -r "useTranslation" src/components/` 看现有 namespace 用法
- 在 `saome-form-integrity` skill 或 `AGENTS.md` 补充 i18n namespace 对齐 checklist
