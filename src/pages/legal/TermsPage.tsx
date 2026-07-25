export function TermsPage() {
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
          服務條款
        </h1>

        <div className="mt-10 space-y-8 text-sm leading-relaxed">
          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              1. 服務範圍與授權
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>1.1 服務提供</strong>
                — 本公司同意根據本條款及您所簽署的訂單，向您提供 Saome 掃我 平台服務，該服務旨在允許您建立、管理和執行客戶忠誠計畫。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>1.2 授權授予</strong>
                — 本公司在此授予您有限的、非排他性的、不可轉讓的、不可再授權的權利，僅供您在內部商業用途中使用本服務。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>1.3 終端使用者</strong>
                — 您對授權的終端使用者（即您企業內使用本平台的員工）的行為負全部責任，並須確保所有終端使用者遵守本條款。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              2. 客戶義務與限制
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>2.1 客戶資料所有權與授權</strong>
                — 您保留您上傳、儲存或經由本服務處理的所有客戶資料的所有權。您授予本公司一項全球性的、免版稅的、非排他性的、可再授權的權利，僅在履行本服務合約義務所必需的範圍內使用、儲存、複製和展示客戶資料。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>2.2 使用限制</strong>
                — 您不得且必須確保您的終端使用者不得：轉售或出租本服務；反向工程、反編譯或拆解本服務；傳輸任何非法、誹謗或侵犯第三方權利的資料；干擾或破壞本服務的完整性或性能。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              3. 費用、付款與訂閱期限
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>3.1 訂閱費用</strong>
                — 您同意按照您簽署的訂單中規定的費用、週期和付款方式支付服務費用。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>3.2 續訂與終止</strong>
                — 除非一方在當前訂閱期結束前至少 1 天發出通知要求終止，否則訂閱將自動續訂。如果您未能按時支付費用，本公司保留在給予書面通知後暫停或終止您存取本服務的權利。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>3.3 退款政策</strong>
                — 訂閱費用通常不可退還，除非本公司嚴重違反本條款。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              4. 服務水平、保固與免責聲明
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>4.1 服務水平協議</strong>
                — 本公司將提供合理的商業努力確保本服務的可用性，目標服務可用性為 99.9%。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>4.2 免責聲明</strong>
                — 本服務按「現狀」和「現有」提供。本公司不作任何明示或暗示的保證，包括但不限於對適銷性、特定目的適用性或不侵權的保證。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              5. 知識產權與資料保護
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>5.1 知識產權</strong>
                — 本服務及所有相關的軟體、技術、設計、商標和文件中的所有知識產權，均歸本公司或其授權人所有。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>5.2 資料保護與 GDPR</strong>
                — 本條款與《資料處理協議》一併適用。本公司在處理您的終端客戶資料時，擔任資料處理者的角色。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              6. 責任限制與賠償
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>6.1 責任限制</strong>
                — 本公司對您因本條款或本服務引起的所有索賠所承擔的總累積責任上限，應不超過在導致索賠事件發生之前的十二 (12) 個月內，您為本服務支付的總金額。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>6.2 間接損害排除</strong>
                — 在任何情況下，本公司均不對任何間接的、附帶的、懲罰性的或特殊的損害負責。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>6.3 賠償</strong>
                — 您同意為本公司辯護、賠償並使其免於承擔因您對本服務的使用方式違反本條款、或您上傳的客戶資料侵犯任何第三方權利所引起的索賠。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              7. 終止條款
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>7.1 因故終止</strong>
                — 任一方可因另一方嚴重違反本條款，且未能在收到書面通知後 30 天內補救該違約行為，而立即終止本條款。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>7.2 終止的後果</strong>
                — 終止後，您使用本服務的權利將立即停止。本公司將根據 DPA 條款安全刪除或歸還所有個人資料副本。
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-3 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              8. 一般條款
            </h2>
            <div className="space-y-3">
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>8.1 準據法</strong>
                — 本條款受中華民國法律管轄，並按其解釋，不考慮其衝突法原則。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>8.2 爭議解決</strong>
                — 任何因本條款引起或相關的爭議，雙方應首先嘗試通過善意協商解決。若協商不成，則同意提交至台北地方法院進行訴訟。
              </p>
              <p>
                <strong style={{ color: 'var(--color-primary)' }}>8.3 完整協議</strong>
                — 本條款與訂單、隱私權政策和 DPA 共同構成您與本公司之間關於本服務的完整協議，並取代雙方先前就此事項達成的所有書面或口頭協議。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
