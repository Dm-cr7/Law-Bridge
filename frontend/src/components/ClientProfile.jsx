import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { X, Edit, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";
import { socket } from "@/utils/socket";
import { useAuth } from "@/context/AuthContext";

const ClientProfile = ({ client, onClose }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (client?._id) {
      fetchClientData();
    }

    // 🔔 Realtime refresh triggers
    socket.on("case:new", fetchClientData);
    socket.on("case:update", fetchClientData);
    socket.on("task:new", fetchClientData);
    socket.on("task:update", fetchClientData);

    return () => {
      socket.off("case:new", fetchClientData);
      socket.off("case:update", fetchClientData);
      socket.off("task:new", fetchClientData);
      socket.off("task:update", fetchClientData);
    };
  }, [client]);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      const [caseRes, taskRes] = await Promise.all([
        axios.get(`/api/cases?client=${client._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/tasks?assignedTo=${client._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setCases(caseRes.data);
      setTasks(taskRes.data);
    } catch (err) {
      toast.error("Failed to fetch client data");
    } finally {
      setLoading(false);
    }
  };

  if (!client) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-5xl h-[90vh] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-semibold">{client.name}</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={fetchClientData}
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" title="Edit Client (coming soon)">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
          <TabsList className="flex space-x-4 border-b mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cases">Cases</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-black-600">{client.email || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Phone</h3>
                <p className="text-black-600">{client.phone || "N/A"}</p>
              </div>
              <div>
                <h3 className="font-semibold">Joined On</h3>
                <p className="text-black-600">
                  {new Date(client.createdAt).toLocaleDateString()}
                </p>
              </div>
              {client.address && (
                <div>
                  <h3 className="font-semibold">Address</h3>
                  <p className="text-black-600">{client.address}</p>
                </div>
              )}
            </CardContent>
          </TabsContent>

          {/* Cases */}
          <TabsContent value="cases">
            {loading ? (
              <p className="text-black-500">Loading cases...</p>
            ) : cases.length === 0 ? (
              <p className="text-black-500">No cases found.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[60vh]">
                {cases.map((c) => (
                  <Card key={c._id} className="p-3 hover:bg-black-50">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold">{c.title}</h3>
                        <p className="text-sm text-black-600">
                          Status:{" "}
                          <span className="capitalize">{c.status}</span>
                        </p>
                      </div>
                      <p className="text-xs text-black-400">
                        Filed: {new Date(c.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks">
            {loading ? (
              <p className="text-black-500">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="text-black-500">No tasks assigned.</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[60vh]">
                {tasks.map((t) => (
                  <Card key={t._id} className="p-3 hover:bg-black-50">
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold">{t.title}</h3>
                        <p className="text-sm text-black-600">
                          Status:{" "}
                          <span className="capitalize">{t.status}</span>
                        </p>
                        <p className="text-sm text-black-500">
                          Due: {new Date(t.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      {t.priority && (
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full ${
                            t.priority === "high"
                              ? "bg-red-100 text-red-700"
                              : t.priority === "medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {t.priority}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default ClientProfile;
