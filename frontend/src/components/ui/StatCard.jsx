import {
  TrendingUp,
  Users,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";

const icons = {
  interviews: CalendarDays,
  completed: CheckCircle2,
  candidates: Users,
  score: TrendingUp,
};

function StatCard({
  title,
  value,
  description,
  type = "interviews",
}) {
  const Icon = icons[type] || CalendarDays;

  return (
    <div className="stat-card">

      <div className="stat-card-top">

        <div className="stat-icon">
          <Icon size={20} />
        </div>

      </div>

      <div className="stat-value">
        {value}
      </div>

      <div className="stat-title">
        {title}
      </div>

      {description && (
        <div className="stat-description">
          {description}
        </div>
      )}

    </div>
  );
}

export default StatCard;