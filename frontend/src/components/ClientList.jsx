import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { Eye, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { socket } from "@/utils/socket";
import NewClientModal from "./NewClientModal";
import ClientProfile from "./ClientProfile";

const ClientList = () => {
  const { user, token } = useAuth();
  const [clients, setClients] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    fetchClients();

    // ✅ Realtime updates from socket
    socket.on("client:new", fetchClients);
    socket.on("client:update", fetchClients);
    socket.on("client:deleted", fetchClients);
    socket.on("client:restored", fetchClients);

    return () => {
      socket.off("client:new", fetchClients);
      socket.off("client:update", fetchClients);
      socket.off("client:deleted", fetchClients);
      socket.off("client:restored", fetchClients);
    };
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/clients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClients(res.data);
      setFiltered(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Search Filter
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(clients);
    } else {
      setFiltered(
        clients.filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, clients]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clients</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={fetchClients} variant="outline">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          {(user.role === "advocate" || user.role === "admin") && (
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> New Client
            </Button>
          )}
        </div>
      </div>

      {/* 🔄 Loading */}
      {loading ? (
        <p className="text-black-500">Loading clients...</p>
      ) : filtered.length === 0 ? (
        <p className="text-black-500">No clients found.</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card
              key={client._id}
              className="shadow hover:shadow-lg transition cursor-pointer"
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">{client.name}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedClient(client)}
                  >
                    <Eye className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-sm text-black-500">{client.email}</p>
                {client.phone && (
                  <p className="text-sm text-black-500">{client.phone}</p>
                )}
                <p className="text-xs text-black-400">
                  Added: {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ➕ Add New Client Modal */}
      {showNewModal && (
        <NewClientModal
          onClose={() => setShowNewModal(false)}
          onSuccess={fetchClients}
        />
      )}

      {/* 👤 Client Profile Modal */}
      {selectedClient && (
        <ClientProfile
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
};

export default ClientList;
