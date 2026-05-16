import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminDataList } from "@/admin/components/AdminDataList";

const mockColumns = [
  { key: "name", label: "Tên" },
  { key: "email", label: "Email" },
  { key: "role", label: "Vai trò" },
];

const mockData = [
  { id: "1", name: "Nguyễn Văn A", email: "a@test.com", role: "admin" },
  { id: "2", name: "Trần Thị B", email: "b@test.com", role: "user" },
];

describe("AdminDataList", () => {
  it("renders items correctly", () => {
    render(
      <AdminDataList
        data={mockData}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
      />,
    );
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("Trần Thị B")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(
      <AdminDataList
        data={[]}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        emptyMessage="Không có user nào"
      />,
    );
    expect(screen.getByText("Không có user nào")).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    render(
      <AdminDataList
        data={[]}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        emptyMessage="Danh sách trống"
      />,
    );
    expect(screen.getByText("Danh sách trống")).toBeInTheDocument();
  });

  it("shows loading spinner when loading=true", () => {
    const { container } = render(
      <AdminDataList
        data={[]}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        loading
      />,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("does not show empty state when loading", () => {
    render(
      <AdminDataList
        data={[]}
        keyExtractor={(item) => item.id}
        renderItem={(item) => <div>{item.name}</div>}
        loading
        emptyMessage="Should not appear"
      />,
    );
    expect(screen.queryByText("Should not appear")).not.toBeInTheDocument();
  });

  it("calls renderItem for each item", () => {
    const items: string[] = [];
    render(
      <AdminDataList
        data={mockData}
        keyExtractor={(item) => item.id}
        renderItem={(item) => {
          items.push(item.name);
          return <div data-testid={`item-${item.id}`}>{item.name}</div>;
        }}
      />,
    );
    expect(items).toEqual(["Nguyễn Văn A", "Trần Thị B"]);
    expect(screen.getByTestId("item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-2")).toBeInTheDocument();
  });
});
