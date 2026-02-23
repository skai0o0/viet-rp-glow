import { Link } from "react-router-dom";

const AppFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-border bg-card/50 mt-auto py-4 px-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>© {year} VietRP. Mọi quyền được bảo lưu.</span>
        <Link
          to="/terms"
          className="hover:text-foreground transition-colors underline underline-offset-2"
        >
          Điều khoản & Miễn trừ trách nhiệm
        </Link>
      </div>
    </footer>
  );
};

export default AppFooter;
