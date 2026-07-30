# SAOME Form Integrity Skill

> 觸發條件：寫任何 multi-step form、表單含 `<input type="email">` /
> `<input type="password">`、或 debug「使用者沒打過的值卻出現在 submit
> payload」、「DB rows 欄位值長得怪怪的」、「schema 跟 DB 對不上」時。

## 目的

把 2026-07-31 register 表單三連環事故的修法沉澱成可重複使用的 playbook。
對齊的規則見 `.cursor/rules/018-form-autofill-and-multi-step-state.mdc` 跟
`.cursor/rules/019-schema-contract-drift.mdc`。

## 何時必須觸發

下列任一情況發生時，**必須**立即引用此 skill：

1. 寫新 multi-step form（兩步以上、跨 sessionStorage / context 傳值）
2. 寫含 `<input type="email" autoComplete="email">` 的 form
3. 寫含 `<input type="password" autoComplete="new-password">` 的 form
4. Debug 「使用者 input 沒打 X 但 submit 出來是 X」的 bug
5. Debug 「DB rows 的某個欄位值跟 user 互動對不上」
6. 改 `apps/backend/src/modules/<module>/schemas/request.ts`
7. 加新的 DB migration

## 流程

### Step A — Reproduce the autofill bleed-through

**不要直接猜**。先把 bug 抓進 Playwright probe。

Probe 模板見 `tests/probe/register-probe.ts`。關鍵抓的東西：

| 抓的東西 | 為什麼 |
|---------|-------|
| Step 1 各 input 在 `page.fill()` 後的 `value` | baseline |
| Step 2 各 input 在 raf 1 / raf 2 / +100ms 的 `value` | autofill 是非同步，要多點取樣 |
| 每個 tick 的 RHF `_formValues`（從 `accountForm.control._formValues` 偷看） | 證明 RHF 有沒有同步 autofill |
| `emailValueAfterTyping` 在使用者實際 `page.fill(...)` 後的值 | 證明「正常使用」路徑還能用 |

Probe 跑完，console 會 print 一個 JSON tree。把這份 JSON 當作 bug repro
的證據（commit 進 feedback file 更好）。

### Step B — Trace the divergence

讀 probe 的 JSON，依下面判讀：

| 觀察 | 結論 |
|------|-----|
| `input.value !== ''` 在使用者沒打字時 | **autofill bleed-through**。修法見 Step C |
| `input.value !== form._formValues` | **RHF vs DOM 不一致**。RHF `isDirty` 維持 false，但實際值已被改 |
| `input.value === ''` 但 submit 帶了非空值 | **schema 對不上 / payload merge bug**。看 Step E |
| DB rows 的欄位是 `contact_name_prefix + "@xxx"` | **Chrome 自動填把 Step 1 的 contact name 讀進去拼 email**。確認是 autofill |
| 後端 zod 過、前端 zod 也過，但 backend runtime 拒收某欄位 | **schema drift**（見 Step E） |

### Step C — Apply the autofill dual-fix

> 完整程式碼見 rule 018 的「鐵律 1: autofill contract」。

兩件事必同時做：

1. **清 DOM**：在 raf 1、raf 2、setTimeout(100) 三個時點
   `emailInput.value = ''`。
2. **對齊 RHF**：`accountForm.setValue(name, '', { shouldDirty: false })`。

```ts
useEffect(() => {
  if (step !== 1) return;
  const clearAutofill = () => {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    if (emailInput && emailInput.value !== '') {
      emailInput.value = '';
    }
    accountForm.setValue('email', '', { shouldDirty: false });
    accountForm.setValue('password', '', { shouldDirty: false });
    accountForm.setValue('confirmPassword', '', { shouldDirty: false });
  };
  const raf1 = requestAnimationFrame(clearAutofill);
  const raf2 = requestAnimationFrame(() => requestAnimationFrame(clearAutofill));
  const timeoutId = window.setTimeout(clearAutofill, 100);
  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    window.clearTimeout(timeoutId);
  };
}, [step, accountForm]);
```

額外針對 password manager 的 hint：

| 欄位 | 屬性 |
|------|-----|
| `<input type="email">` | `autoComplete="email"` + `data-1p-ignore` + `data-lpignore="true"` |
| `<input type="password">`（註冊） | `autoComplete="new-password"` + `data-1p-ignore` |
| `<input type="password">`（登入） | `autoComplete="current-password"` + `data-1p-ignore` |

### Step D — Add a regression test

寫 `*.test.tsx` 用 `@testing-library/user-event` 驗證：

```ts
test('Step 2 mount clears autofilled values', async () => {
  const user = userEvent.setup();
  render(<RegisterForm />);
  await user.click(screen.getByRole('button', { name: /next/i }));
  await waitFor(() => {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    expect(emailInput?.value).toBe('');
  });
});
```

> jsdom 不會觸發 Chrome autofill，所以這條 test 主要是防止「未來有人
> 改壞 dual-fix」+ 確認 DOM → RHF reconcile 還在。

### Step E — Schema drift check

開 PR 前**必跑**：

```bash
node scripts/check-shared-schema-sync.cjs
```

(腳本見 plan optional-script 段；如果還沒建，至少手動對照兩邊
`registrationPayloadSchema.shape` 的 keys。)

如果有 drift：

1. 先決定哪邊是 source of truth（**應該是 `packages/shared/schemas/`**）
2. 改另一邊 align source of truth
3. 加 conformance test（見 rule 019 的 conformance test 範本）
4. 加 migration 如果新欄位要落 DB

## 與其他 skill 的關係

- `saome-self-improvement`：本 skill 處理「怎麼修表單 / schema bug」，
  它處理「修完要不要 push feedback」
- `superpowers:test-driven-development`：寫 regression test 時遵循
- `superpowers:systematic-debugging`：probe 沒抓到東西時，往哪挖
- `superpowers:verification-before-completion`：claim 完成前必跑

## 禁止

- ❌ 只改後端 stub 沒同步 shared — 讓前端繼續送錯的值
- ❌ 只加 `autoComplete="off"` 不寫 raf+timeout sweep — Chrome 會忽略
- ❌ 拿 RHF `isDirty` 當「使用者確認過所有欄位」的 gate — 它不是
- ❌ 沒寫 Playwright probe 就宣稱修好 autofill bug — unit test 在 jsdom
  下抓不到
- ❌ 新增 DB column 沒同個 commit 帶 migration + shared schema + backend
  insert — 後續 drift 又會出現