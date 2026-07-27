# Data Model: Member Badge

## Entities

### MemberBadge Props

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tier | 'bronze' \| 'silver' \| 'gold' | Yes | 會員等級 |
| size | 'sm' \| 'md' \| 'lg' | No | 元件大小（default: 'md'） |
| className | string | No | 自訂樣式 |

### Member Tier Schema

引用自 `packages/shared/schemas/member.ts`:

```typescript
export const memberTierSchema = z.enum(['bronze', 'silver', 'gold']);
```

### i18n Keys

引用自 `packages/shared/i18n/zh-TW.ts`:

```typescript
member.tier.bronze  // '銅牌'
member.tier.silver  // '銀牌'
member.tier.gold    // '金牌'
```

## Visual Design

| Tier | Icon | Color Token | Text |
|------|------|-------------|------|
| Bronze | Award | text-amber-700 | 銅牌 |
| Silver | Award | text-slate-500 | 銀牌 |
| Gold | Award | text-yellow-500 | 金牌 |

## Relationships

- MemberBadge 屬於 `business/member/` 範疇
- 與 `Member` entity 關聯（透過 `tier` 欄位）
- 與 `getTierDisplayName` 純函式關聯
