export function CrisisBanner({ hotlines }: { hotlines: string[] }) {
  return (
    <div className="alert" role="alert" data-testid="crisis-banner">
      <strong>지금 위험한 상황이라면 즉시 도움을 받아 주세요.</strong>
      <p>
        긴급 연락처:{" "}
        {hotlines.map((number) => (
          <a key={number} href={`tel:${number}`} style={{ marginRight: "0.75rem" }}>
            {number}
          </a>
        ))}
      </p>
      <p className="small">
        이 화면의 AI 상담은 잠시 멈췄습니다. 가까운 주민센터나 복지관에도 문의할 수 있어요.
      </p>
    </div>
  );
}
