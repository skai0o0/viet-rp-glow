import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-oled-base p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
              <span className="text-2xl">!</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Đã xảy ra lỗi</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || "Ứng dụng gặp lỗi không xác định."}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="border-gray-border text-foreground"
                onClick={this.handleReset}
              >
                Thử lại
              </Button>
              <Button
                className="bg-neon-purple text-primary-foreground"
                onClick={() => window.location.href = "/"}
              >
                Về trang chủ
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
