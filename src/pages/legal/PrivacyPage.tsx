export function PrivacyPage() {
  return (
    <div className="bg-background py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm text-secondary">生效日期：2025/09/29</p>
        <h1 className="mt-2 text-3xl font-bold text-primary">隱私權政策</h1>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-secondary">
          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">A. 聯絡資訊與總則</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {[
                    ['資料控制者', 'Saome 掃我，地址：[我的公司地址]'],
                    ['資料保護聯絡人', 'E-mail: rex@saome.org'],
                    ['生效日期', '註冊即生效'],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td className="w-40 bg-muted px-4 py-3 font-medium text-primary">{k}</td>
                      <td className="px-4 py-3">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">B. 資料收集、目的與法律依據</h2>
            <p className="mb-3">我們僅基於明確、合法和特定的目的收集和處理您的個人資料。</p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-primary">資料類型</th>
                    <th className="px-4 py-2 text-left font-medium text-primary">處理目的</th>
                    <th className="px-4 py-2 text-left font-medium text-primary">法律依據</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ['帳戶與聯絡資訊', '履行契約、帳戶管理、發送服務通知', 'GDPR 第 6(1)(b) 條'],
                    ['交易與帳單資訊', '處理服務費用、履行會計和稅務法律義務', 'GDPR 第 6(1)(c)(b) 條'],
                    ['產品使用資訊', '監控平台安全、改善服務功能、防止欺詐', 'GDPR 第 6(1)(f) 條'],
                  ].map(([type, purpose, basis]) => (
                    <tr key={type}>
                      <td className="px-4 py-3 align-top font-medium text-primary">{type}</td>
                      <td className="px-4 py-3 align-top">{purpose}</td>
                      <td className="px-4 py-3 align-top">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">C. 資料處理者的角色</h2>
            <p>對於您上傳到我們平台的終端客戶個人資料，我們僅作為資料處理者，依據您作為控制者的指示處理這些資料。我們不會將這些終端客戶資料用於我們自己的任何目的，並受到與您簽訂的 DPA 約束。</p>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">D. 資料共享、國際傳輸與次級處理者</h2>
            <div className="space-y-3">
              <p><strong className="text-primary">次級處理者</strong> — 為了提供服務，我們與協力廠商共享您的資料，包括：雲端託管：Cloudway 和 DigitalOcean。</p>
              <p><strong className="text-primary">國際資料傳輸</strong> — 由於我們的託管服務涉及 DigitalOcean（一家美國公司），您的個人資料可能被傳輸到歐洲經濟區以外的國家。我們確保傳輸的合法性：已與服務供應商簽訂最新的歐盟標準契約條款（SCCs），並實施了額外的技術和組織措施。</p>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">E. 資料主體的權利</h2>
            <p className="mb-3">作為資料主體，您有權向我們行使以下權利：</p>
            <ul className="list-inside list-disc space-y-1">
              {[
                ['存取權 (Access)', '取得我們所持有關於您的資料副本'],
                ['更正權 (Rectification)', '要求更正不準確或不完整的資料'],
                ['刪除權 (Erasure)', '在特定條件下，要求刪除您的個人資料'],
                ['限制處理權 (Restriction)', '在爭議解決期間，要求限制處理您的資料'],
                ['資料可攜權 (Data Portability)', '接收您以結構化格式提供給我們的資料'],
                ['反對權 (Objection)', '反對基於「合法利益」處理您的個人資料'],
              ].map(([title, desc]) => (
                <li key={title}><strong className="text-primary">{title}</strong> — {desc}</li>
              ))}
            </ul>
            <p className="mt-3">您有權隨時向歐盟成員國的資料保護監管機構提出投訴。</p>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-primary">F. 資料保留與安全性</h2>
            <div className="space-y-3">
              <p><strong className="text-primary">資料保留</strong> — 我們只會將您的個人資料保留在實現本政策所述目的所需的期間內。一旦您的帳戶終止，我們將根據 DPA 規定的寬限期安全地刪除或匿名化您的資料。</p>
              <p><strong className="text-primary">安全性</strong> — 我們實施了嚴格的 TOMS 來保護您的資料免受未經授權的存取、披露或遺失。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
