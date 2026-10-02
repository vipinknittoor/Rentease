import { useNavigate } from "react-router-dom";
import "./PageNav.css";

export type PageKey =
  | "rooms"
  | "tenants"
  | "payments"
  | "generate-bills";

interface NavItem {
  key: PageKey | "home";
  label: string;
  icon: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    label: "Home",
    icon: "🏠",
    path: "/owner-dashboard",
  },
  {
    key: "rooms",
    label: "Rooms",
    icon: "🛏️",
    path: "/rooms",
  },
  {
    key: "tenants",
    label: "Tenants",
    icon: "👥",
    path: "/tenants",
  },
  {
    key: "payments",
    label: "Payments",
    icon: "💳",
    path: "/payments",
  },
  {
    key: "generate-bills",
    label: "Generate Bills",
    icon: "📅",
    path: "/generate-bills",
  },
];

interface PageNavProps {
  
  current: PageKey;
}

function PageNav({ current }: PageNavProps) {
  const navigate = useNavigate();

  
  const otherItems = NAV_ITEMS.filter(
    (item) => item.key !== current
  );

  
  const handleBackToDashboard = () => {
    navigate("/owner-dashboard");
  };

  
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <div className="page-nav">

      
      <button
        type="button"
        className="page-nav-back-btn"
        onClick={handleBackToDashboard}
      >
        <span className="page-nav-back-arrow">
          ←
        </span>

        <span>
          Back to Dashboard
        </span>
      </button>


      
      <div className="page-nav-icons">

        {otherItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              item.key === "home"
                ? "page-nav-icon-btn page-nav-icon-home"
                : "page-nav-icon-btn"
            }
            onClick={() => handleNavigation(item.path)}
            title={item.label}
          >

            
            <span className="page-nav-icon-emoji">
              {item.icon}
            </span>

            
            <span className="page-nav-icon-label">
              {item.label}
            </span>

          </button>
        ))}

      </div>
    </div>
  );
}

export default PageNav;