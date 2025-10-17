"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useAuth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Edit2, Trash2, X } from "lucide-react";

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const auth = useRequireAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    password: "",
    role: "user"
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (auth.isAuthenticated) {
      loadUsers();
    }
  }, [auth.isAuthenticated]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/users");
      const data = await response.json();

      if (data.success) {
        setUsers(data.data);
      } else {
        showMessage("error", "Erro ao carregar usuários");
      }
    } catch (error) {
      console.error("Error loading users:", error);
      showMessage("error", "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        showMessage("success", data.message);
        loadUsers();
        closeForm();
      } else {
        showMessage("error", data.message);
      }
    } catch (error) {
      console.error("Error saving user:", error);
      showMessage("error", "Erro ao salvar usuário");
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: "",
      role: user.role
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm("Tem certeza que deseja deletar este usuário?")) return;

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        showMessage("success", "Usuário deletado com sucesso");
        loadUsers();
      } else {
        showMessage("error", data.message);
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      showMessage("error", "Erro ao deletar usuário");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      email: "",
      name: "",
      password: "",
      role: "user"
    });
  };

  const openNewUserForm = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      name: "",
      password: "",
      role: "user"
    });
    setShowForm(true);
  };

  if (!auth.isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold text-slate-800">Gerenciar Usuários</h1>
          </div>
          <Button
            onClick={openNewUserForm}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {editingUser ? "Editar Usuário" : "Novo Usuário"}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={closeForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="password">
                      Senha {editingUser && "(deixe em branco para não alterar)"}
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Função</Label>
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeForm}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    {editingUser ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-slate-500">Carregando...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhum usuário cadastrado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Nome
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Função
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        Cadastrado em
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{user.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{user.email}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {user.role === "admin" ? "Admin" : "Usuário"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(user.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {user.id !== 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(user.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
