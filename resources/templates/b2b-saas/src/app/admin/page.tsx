import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/service/auth";
import { listAllUsers } from "@/lib/service/admin";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }
  const users = await listAllUsers();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold">Admin — Users</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Email</th>
            <th className="py-2">Name</th>
            <th className="py-2">Role</th>
            <th className="py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2 font-mono">{u.email}</td>
              <td className="py-2">{u.name ?? "—"}</td>
              <td className="py-2">{u.role}</td>
              <td className="py-2 text-gray-500">
                {u.createdAt.toISOString().slice(0, 10)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
