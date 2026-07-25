export function GDPRPage() {
  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          生效日期：2025/09/29
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          資料處理協議 (DPA)
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          本協議是《主服務協議》（MSA）的附件，於 2025/09/29 生效。
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              A. 當事方
            </h2>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <tbody style={{ borderColor: 'var(--color-border)' }}>
                  {[
                    ['資料控制者 (Controller)', '貴寶號，地址：[企業客戶地址]'],
                    ['資料處理者 (Processor)', 'Saome.org，地址：[我的公司地址]'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderColor: 'var(--color-border)' }}>
                      <td
                        className="w-52 px-4 py-3 font-medium"
                        style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}
                      >
                        {k}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--color-muted-foreground)' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              B. 處理的範圍與細節（GDPR 第 28(3) 條）
            </h2>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-muted)' }}>
                  <tr>
                    <th
                      className="px-4 py-2 text-left font-medium"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      項目
                    </th>
                    <th
                      className="px-4 py-2 text-left font-medium"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      描述
                    </th>
                  </tr>
                </thead>
                <tbody style={{ borderColor: 'var(--color-border)' }}>
                  {[
                    ['處理的目的', '處理者將依據控制者指示，透過本平台提供忠誠計畫服務，包括建立、發放、管理和儲存會員卡、點數、消費紀錄，並生成相關報告。'],
                    ['資料主體類別', '控制者的終端客戶（即忠誠計畫的會員/參與者）。'],
                    ['個人資料類別', '姓名、電子郵件地址、電話號碼、會員 ID、消費紀錄、點數歷史、購買習慣，以及裝置 ID 或 IP 地址等線上識別資訊。'],
                    ['資料的敏感性', '非特殊類別個人資料。'],
                    ['處理的性質', '收集、記錄、儲存、組織、分析、檢索、傳輸和刪除。'],
                    ['處理期間', '在主服務協議生效期間，以及協議終止後 30 天 的資料移轉或刪除寬限期內。'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderColor: 'var(--color-border)' }}>
                      <td
                        className="w-40 px-4 py-3 align-top font-medium"
                        style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}
                      >
                        {k}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ color: 'var(--color-muted-foreground)' }}>
                        {v}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              C. 處理者的義務與保證
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  僅依指示處理
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  處理者僅依據控制者的書面指示處理個人資料。若處理者認為任何指示違反 GDPR，應立即通知控制者。
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  保密承諾
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  處理者應確保所有接觸個人資料的人員都已簽署保密協議或受到適當的法定義務約束。
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  資訊安全措施 (TOMS)
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  處理者應實施符合 GDPR 第 32 條要求的適當技術與組織措施。措施應包括（但不限於）：
                </p>
                <ul
                  className="ml-5 mt-2 list-disc space-y-1"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <li>資料傳輸與靜態的加密和假名化。</li>
                  <li>確保系統服務的持續機密性、完整性、可用性與彈性。</li>
                  <li>定期測試、評估並改善 TOMS 的有效性。</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  分包處理者（次級處理者）
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>現有次級處理者：</strong>
                  Cloudway（託管服務）和 DigitalOcean（雲端基礎設施）。
                </p>
                <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>新增次級處理者：</strong>
                  處理者承諾向控制者提供一個機制來通知任何新增或替換次級處理者，並給予控制者 30 天的反對期。
                </p>
                <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  <strong style={{ color: 'var(--color-primary)' }}>責任：</strong>
                  處理者保證次級處理者承擔與本 DPA 相同的資料保護義務，並對次級處理者的作為或不作為負完全責任。
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  協助義務
                </h3>
                <ul className="ml-5 list-disc space-y-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  <li>
                    <strong style={{ color: 'var(--color-primary)' }}>資料主體權利 (DSR)：</strong>
                    協助控制者回應終端客戶行使存取、更正、刪除、限制處理和資料可攜權等 DSR 請求。
                  </li>
                  <li>
                    <strong style={{ color: 'var(--color-primary)' }}>影響評估：</strong>
                    協助控制者進行資料保護影響評估 (DPIA) 及事先諮詢。
                  </li>
                  <li>
                    <strong style={{ color: 'var(--color-primary)' }}>資料外洩通報：</strong>
                    一旦發現任何資料安全事件或外洩，處理者應立即通知控制者，並提供所有必要資訊。
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              D. 服務終止與審計
            </h2>
            <div className="space-y-3">
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>服務終止處理：</strong>
                於服務終止後，處理者應根據控制者的指示，安全刪除或歸還所有個人資料副本。
              </p>
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                <strong style={{ color: 'var(--color-primary)' }}>審計與證據：</strong>
                處理者應向控制者提供所有必要資訊，以證明遵守本 DPA，並在合理的範圍內，允許控制者或其指定的獨立審計員進行審計。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
