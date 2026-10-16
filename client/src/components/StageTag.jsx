const stages = {
  applied: { icon: "○", label: "Applied" },
  onlineAssessment: { icon: "■", label: "Online Assessment" },
  interview: { icon: "▲", label: "Interview" },
  offer: { icon: "✓", label: "Offer" },
  rejected: { icon: "✗", label: "Rejected" },
};

function StageTag({ stage }) {
  const { icon, label } = stages[stage];
  return <span className={`stage-tag stage-tag--${stage}`}><span aria-hidden="true">{icon}</span> {label}</span>;
}

export default StageTag;
