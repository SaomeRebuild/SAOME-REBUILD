import { useTranslation } from 'react-i18next';

export function GDPRPage() {
  const { t } = useTranslation();

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.gdpr.date')}
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('legal.gdpr.title')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.gdpr.subtitle')}
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <section>
            <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              A. {t('legal.gdpr.sA')}
            </h2>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <tbody style={{ borderColor: 'var(--color-border)' }}>
                  {[
                    ['資料控制者 (Controller)', '貴寶號，地址：[企業客戶地址]'],
                    ['資料處理者 (Processor)', 'Saome.org，地址：[我的公司地址]'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderColor: 'var(--color-border)' }}>
                      <td className="w-52 px-4 py-3 font-medium" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}>
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
            <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              B. {t('legal.gdpr.sB')}
            </h2>
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: 'var(--color-muted)' }}>
                  <tr>
                    <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--color-primary)' }}>項目</th>
                    <th className="px-4 py-2 text-left font-medium" style={{ color: 'var(--color-primary)' }}>描述</th>
                  </tr>
                </thead>
                <tbody style={{ borderColor: 'var(--color-border)' }}>
                  {[
                    ['處理的目的', '透過本平台提供忠誠計畫服務，包括建立、發放、管理和儲存會員卡、點數、消費紀錄。'],
                    ['資料主體類別', '控制者的終端客戶（即忠誠計畫的會員/參與者）。'],
                    ['個人資料類別', '姓名、電子郵件地址、電話號碼、會員 ID、消費紀錄、點數歷史等。'],
                    ['資料的敏感性', '非特殊類別個人資料。'],
                    ['處理的性質', '收集、記錄、儲存、組織、分析、檢索、傳輸和刪除。'],
                    ['處理期間', '在主服務協議生效期間，以及協議終止後 30 天內。'],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderColor: 'var(--color-border)' }}>
                      <td className="w-40 px-4 py-3 align-top font-medium" style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}>
                        {k}
                      </td>
                      <td className="px-4 py-3 align-top" style={{ color: 'var(--color-muted-foreground)' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              C. {t('legal.gdpr.sC')}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>僅依指示處理</h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>處理者僅依據控制者的書面指示處理個人資料。</p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>保密承諾</h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>處理者應確保所有接觸個人資料的人員都已簽署保密協議。</p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>資訊安全措施 (TOMS)</h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>處理者應實施符合 GDPR 第 32 條要求的適當技術與組織措施。</p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>分包處理者</h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}><strong>現有次級處理者：</strong>Cloudway（託管服務）和 DigitalOcean（雲端基礎設施）。</p>
                <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}><strong>新增次級處理者：</strong>處理者承諾給予控制者 30 天的反對期。</p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>協助義務</h3>
                <ul className="ml-5 list-disc space-y-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  <li><strong>資料主體權利 (DSR)：</strong>協助回應終端客戶行使存取、更正、刪除等 DSR 請求。</li>
                  <li><strong>影響評估：</strong>協助進行資料保護影響評估 (DPIA)。</li>
                  <li><strong>資料外洩通報：</strong>一旦發現任何資料安全事件，應立即通知控制者。</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              D. {t('legal.gdpr.sD')}
            </h2>
            <div className="space-y-3">
              <p style={{ color: 'var(--color-muted-foreground)' }}><strong>服務終止處理：</strong>於服務終止後，處理者應安全刪除或歸還所有個人資料副本。</p>
              <p style={{ color: 'var(--color-muted-foreground)' }}><strong>審計與證據：</strong>處理者應提供所有必要資訊以證明遵守本 DPA。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
