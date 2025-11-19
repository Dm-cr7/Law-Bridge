// frontend/src/pages/Profile.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Cropper from "react-easy-crop";
import getCroppedImg from "../utils/cropImage"; // helper below (or create at src/utils/cropImage.js)
import { motion as Motion } from "framer-motion";
import {
  User,
  Shield,
  Save,
  Loader2,
  Camera,
  Lock,
  LogOut,
  Download,
  Check,
  X,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

/**
 * Profile page:
 * - zod + react-hook-form validations
 * - avatar cropping (react-easy-crop) before upload
 * - password strength meter
 * - activity feed + exports
 */

/* ===========================
   ZOD Schemas
   =========================== */
const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => (v === "" ? true : /^\+?\d{7,15}$/.test(v)), "Phone should be +country and numbers"),
  organization: z.string().max(100).optional().or(z.literal("")),
  bio: z.string().max(500).optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "Current password required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(8, "Confirm new password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

/* ===========================
   Password strength utility
   (simple, adjustable)
   =========================== */
function passwordStrength(password) {
  if (!password) return { score: 0, label: "Empty" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { score, label: labels[score] || "Unknown" };
}

/* ===========================
   Component
   =========================== */
const TABS = ["Overview", "Security", "Activity", "Export"];

export default function Profile() {
  const auth = useAuth() || {};
  const { user: authUser, setUser } = auth;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // avatar + cropping
  const [rawAvatar, setRawAvatar] = useState(null); // data URL or file URL before cropping
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

  // 2FA / activity states
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState("Overview");

  // cancellation & mounted guard
  const isMounted = useRef(true);
  const controllers = useRef([]);

  // form hooks
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty: formDirty },
    reset: resetProfileForm,
    watch,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      organization: "",
      bio: "",
    },
    mode: "onBlur",
  });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    watch: watchPwd,
    formState: { errors: pwdErrors },
    reset: resetPwd,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
    mode: "onChange",
  });

  // watch new password for strength meter
  const newPassword = watchPwd("newPassword", "");

  /* -------------------------
     Load profile + activity
     ------------------------- */
  useEffect(() => {
    isMounted.current = true;
    const ctrl = new AbortController();
    controllers.current.push(ctrl);

    const load = async () => {
      try {
        setLoading(true);
        const res = await API.get("/users/profile", { signal: ctrl.signal });
        if (!isMounted.current) return;
        const data = res.data?.data || res.data;
        setProfile(data);
        resetProfileForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          organization: data.organization || "",
          bio: data.bio || "",
        });
        setTwoFaEnabled(Boolean(data.twoFaEnabled));
        if (data.avatarUrl) {
          // set preview to remote url
          setRawAvatar(data.avatarUrl);
        }
        // load activity in background
        fetchActivity(1);
      } catch (err) {
        const canceled = err?.code === "ERR_CANCELED" || /cancel/i.test(err?.message || "");
        if (!canceled) {
          console.error("Failed to load profile", err);
          toast.error(err?.response?.data?.message || "Could not load profile");
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted.current = false;
      controllers.current.forEach((c) => c.abort?.());
      controllers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------
     Activity loader
     ------------------------- */
  async function fetchActivity(page = 1, append = false) {
    setActivityLoading(true);
    const ctrl = new AbortController();
    controllers.current.push(ctrl);
    try {
      const res = await API.get(`/users/activity?page=${page}&limit=12`, { signal: ctrl.signal });
      if (!isMounted.current) return;
      const list = res.data?.data || res.data || [];
      setActivity((prev) => (append ? [...prev, ...list] : list));
      setActivityPage(page);
      setActivityHasMore(Array.isArray(list) && list.length === 12);
    } catch (err) {
      const canceled = err?.code === "ERR_CANCELED" || /cancel/i.test(err?.message || "");
      if (!canceled) {
        console.error("Activity fetch failed", err);
        toast.error("Failed to load activity");
      }
    } finally {
      if (isMounted.current) setActivityLoading(false);
    }
  }

  /* -------------------------
     Save profile (zod validated)
     ------------------------- */
  const onSubmitProfile = async (values) => {
    setSaving(true);
    const ctrl = new AbortController();
    controllers.current.push(ctrl);
    try {
      const res = await API.put("/users/profile", values, { signal: ctrl.signal });
      const data = res.data?.data || res.data;
      setProfile(data);
      // optimistic update auth context if available
      if (typeof setUser === "function") {
        try {
          setUser((prev) => ({ ...(prev || {}), ...data }));
        } catch (e) {
          console.warn("setUser error:", e);
        }
      }
      resetProfileForm(values); // reset dirty state
      toast.success("Profile updated");
    } catch (err) {
      const canceled = err?.code === "ERR_CANCELED" || /cancel/i.test(err?.message || "");
      if (!canceled) {
        console.error("Save profile error:", err);
        toast.error(err?.response?.data?.message || "Failed to save profile");
      }
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  /* -------------------------
     Password change + strength meter
     ------------------------- */
  const pwdStrength = passwordStrength(newPassword);

  const onSubmitPassword = async (payload) => {
    setSaving(true);
    try {
      await API.post("/users/change-password", {
        currentPassword: payload.currentPassword,
        newPassword: payload.newPassword,
      });
      resetPwd();
      toast.success("Password changed");
    } catch (err) {
      console.error("Change password failed", err);
      toast.error(err?.response?.data?.message || "Failed to change password");
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  /* -------------------------
     Avatar selection & cropping
     ------------------------- */
  const inputRef = useRef(null);

  const onChooseAvatar = () => {
    inputRef.current?.click();
  };

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // read as dataURL
    const reader = new FileReader();
    reader.onload = () => {
      setRawAvatar(reader.result);
      setCropOpen(true);
      // clear input for next pick
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const applyCropAndUpload = async () => {
    // get blob from crop
    try {
      const blob = await getCroppedImg(rawAvatar, croppedAreaPixels);
      setCroppedBlob(blob);
      setCropOpen(false);
      // upload
      await uploadAvatarBlob(blob);
    } catch (err) {
      console.error("Crop/upload failed", err);
      toast.error("Failed to process image");
    }
  };

  const uploadAvatarBlob = async (blob) => {
    setAvatarUploading(true);
    setAvatarProgress(0);
    try {
      const form = new FormData();
      form.append("avatar", blob, "avatar.png");
      const res = await API.post("/users/profile/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setAvatarProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      const data = res.data?.data || res.data;
      // update preview & auth context
      setRawAvatar(data.avatarUrl || URL.createObjectURL(blob));
      setProfile((p) => ({ ...(p || {}), avatarUrl: data.avatarUrl || p?.avatarUrl }));
      if (typeof setUser === "function") {
        setUser((prev) => ({ ...(prev || {}), avatarUrl: data.avatarUrl || prev?.avatarUrl }));
      }
      toast.success("Avatar updated");
    } catch (err) {
      console.error("Upload avatar failed", err);
      toast.error(err?.response?.data?.message || "Failed to upload avatar");
    } finally {
      if (isMounted.current) {
        setAvatarUploading(false);
        setAvatarProgress(0);
      }
    }
  };

  /* -------------------------
     2FA toggle
     ------------------------- */
  const toggle2FA = async () => {
    setTwoFaLoading(true);
    try {
      if (twoFaEnabled) {
        await API.post("/users/2fa/disable");
        setTwoFaEnabled(false);
        toast.success("2FA disabled");
      } else {
        await API.post("/users/2fa/enable");
        setTwoFaEnabled(true);
        toast.success("2FA enabled");
      }
    } catch (err) {
      console.error("2FA toggle failed", err);
      toast.error(err?.response?.data?.message || "Failed to update 2FA");
    } finally {
      if (isMounted.current) setTwoFaLoading(false);
    }
  };

  /* -------------------------
     Export PDF
     ------------------------- */
  const handleExportPdf = async () => {
    try {
      const res = await API.get("/users/profile/export?format=pdf", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profile-${(profile?.name || "profile").replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Profile PDF downloaded");
    } catch (err) {
      console.error("Export PDF failed", err);
      toast.error(err?.response?.data?.message || "PDF export failed");
    }
  };

  /* -------------------------
     Helper: logout (optional)
     ------------------------- */
  const handleLogout = async () => {
    try {
      await API.post("/auth/logout");
    } catch {}
    if (typeof setUser === "function") setUser(null);
  };

  /* -------------------------
     Render
     ------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="animate-spin mr-2" /> Loading profile...
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 bg-slate-50 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="bg-white rounded-2xl shadow p-6">
          {/* header */}
          <div className="flex items-center gap-6 border-b pb-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
                {rawAvatar ? (
                  // rawAvatar will be remote url or preview object URL
                  // using img with object-cover
                  <img src={rawAvatar} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={34} className="text-slate-400" />
                )}
              </div>

              <button
                className="absolute -right-1 -bottom-1 p-2 rounded-full bg-white shadow"
                onClick={onChooseAvatar}
                aria-label="Change avatar"
              >
                <Camera size={16} />
              </button>

              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{profile?.name || "Unnamed"}</h2>
              <div className="flex items-center gap-3 mt-1">
                <div className="text-sm text-slate-600">{profile?.email}</div>
                <div className="text-sm text-slate-500 inline-flex items-center gap-2">
                  <Shield size={14} /> {profile?.role || "User"}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleLogout} className="px-3 py-2 rounded-md bg-red-50 text-red-600">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>

          {/* tabs */}
          <div className="mb-6">
            <nav className="flex gap-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-2 rounded-md text-sm ${
                    activeTab === t ? "bg-blue-600 text-white" : "bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>

          {/* content */}
          <div>
            {activeTab === "Overview" && (
              <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <form onSubmit={handleSubmit(onSubmitProfile)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Full name</label>
                    <input {...register("name")} className="w-full rounded border px-3 py-2 mb-1" />
                    {errors.name && <div className="text-xs text-red-600 mb-2">{errors.name.message}</div>}

                    <label className="text-sm text-slate-600 block mb-1">Email</label>
                    <input {...register("email")} className="w-full rounded border px-3 py-2 mb-1" />
                    {errors.email && <div className="text-xs text-red-600 mb-2">{errors.email.message}</div>}

                    <label className="text-sm text-slate-600 block mb-1">Phone</label>
                    <input {...register("phone")} className="w-full rounded border px-3 py-2 mb-1" />
                    {errors.phone && <div className="text-xs text-red-600 mb-2">{errors.phone.message}</div>}

                    <label className="text-sm text-slate-600 block mb-1">Organization</label>
                    <input {...register("organization")} className="w-full rounded border px-3 py-2 mb-1" />
                    {errors.organization && <div className="text-xs text-red-600 mb-2">{errors.organization.message}</div>}

                    <label className="text-sm text-slate-600 block mb-1">Bio</label>
                    <textarea {...register("bio")} className="w-full rounded border px-3 py-2 mb-1" rows={4} />
                    {errors.bio && <div className="text-xs text-red-600 mb-2">{errors.bio.message}</div>}

                    <div className="mt-4 flex justify-end gap-3">
                      <button type="button" onClick={() => resetProfileForm()} className="px-4 py-2 bg-slate-100 rounded">
                        Revert
                      </button>

                      <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2">
                        {saving ? <Loader2 className="animate-spin" /> : <Save />} Save changes
                      </button>
                    </div>
                  </div>

                  <aside className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded">
                      <h4 className="text-sm font-medium mb-2">Quick info</h4>
                      <div className="text-sm text-slate-700">
                        <div><strong>Joined:</strong> {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</div>
                        <div><strong>Last login:</strong> {profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : "—"}</div>
                        <div><strong>Location:</strong> {profile?.location || "—"}</div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded">
                      <h4 className="text-sm font-medium mb-2">Avatar</h4>
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded overflow-hidden">
                          {rawAvatar ? <img src={rawAvatar} className="w-full h-full object-cover" alt="avatar" /> : <User size={28} />}
                        </div>
                        <div>
                          <button className="px-3 py-1 bg-slate-100 rounded" onClick={onChooseAvatar}><Camera size={14} /> Change</button>
                          {avatarUploading && (
                            <div className="mt-2">
                              <div className="text-xs text-slate-600">Uploading {avatarProgress}%</div>
                              <div className="h-2 bg-slate-100 rounded mt-1 overflow-hidden">
                                <div style={{ width: `${avatarProgress}%` }} className="h-2 bg-blue-600" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded">
                      <h4 className="text-sm font-medium mb-2">Role overview</h4>
                      <div className="text-sm text-slate-600">{profile?.bio || "No bio set"}</div>
                    </div>
                  </aside>
                </form>
              </Motion.div>
            )}

            {activeTab === "Security" && (
              <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded">
                    <h4 className="font-semibold mb-3">Change password</h4>
                    <form onSubmit={handleSubmitPwd(onSubmitPassword)} className="space-y-3">
                      <div>
                        <input {...registerPwd("currentPassword")} placeholder="Current password" type="password" className="w-full rounded border px-3 py-2" />
                        {pwdErrors.currentPassword && <div className="text-xs text-red-600">{pwdErrors.currentPassword.message}</div>}
                      </div>
                      <div>
                        <input {...registerPwd("newPassword")} placeholder="New password" type="password" className="w-full rounded border px-3 py-2" />
                        {pwdErrors.newPassword && <div className="text-xs text-red-600">{pwdErrors.newPassword.message}</div>}
                        <div className="mt-2 text-xs">Strength: <strong>{pwdStrength.label}</strong></div>
                        <div className="h-2 bg-slate-100 rounded overflow-hidden mt-1">
                          <div style={{ width: `${(pwdStrength.score / 5) * 100}%` }} className="h-2 bg-gradient-to-r from-red-500 to-green-500" />
                        </div>
                      </div>

                      <div>
                        <input {...registerPwd("confirm")} placeholder="Confirm new password" type="password" className="w-full rounded border px-3 py-2" />
                        {pwdErrors.confirm && <div className="text-xs text-red-600">{pwdErrors.confirm.message}</div>}
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => resetPwd()} className="px-3 py-2 bg-slate-100 rounded">Reset</button>
                        <button type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">Change password</button>
                      </div>
                    </form>
                  </div>

                  <div className="bg-slate-50 p-4 rounded">
                    <h4 className="font-semibold mb-3">Two-factor authentication</h4>
                    <p className="text-sm text-slate-600 mb-3">Add extra security to your account</p>
                    <div className="flex items-center gap-3">
                      <button onClick={toggle2FA} className={`px-3 py-2 rounded ${twoFaEnabled ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                        {twoFaLoading ? <Loader2 className="animate-spin" /> : twoFaEnabled ? <Check /> : <Shield />} {twoFaEnabled ? "Enabled" : "Enable 2FA"}
                      </button>
                      <button onClick={() => setActiveTab("Overview")} className="px-3 py-2 bg-slate-100 rounded">Back</button>
                    </div>
                  </div>
                </div>
              </Motion.div>
            )}

            {activeTab === "Activity" && (
              <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="bg-slate-50 p-4 rounded">
                  <h4 className="font-semibold mb-3">Recent activity</h4>
                  {activityLoading && <div className="text-sm text-slate-600"><Loader2 className="animate-spin inline" /> Loading...</div>}
                  {!activityLoading && activity.length === 0 && <div className="text-sm text-slate-600">No activity</div>}

                  <ul className="space-y-3 mt-3">
                    {activity.map((a) => (
                      <li key={a._id || `${a.type}-${a.ts}`} className="flex justify-between">
                        <div>
                          <div className="text-sm font-medium">{a.title || a.type}</div>
                          <div className="text-xs text-slate-500">{a.description || a.detail}</div>
                        </div>
                        <div className="text-xs text-slate-400">{a.ts ? new Date(a.ts).toLocaleString() : ""}</div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex gap-2 justify-center">
                    {activityHasMore ? (
                      <button onClick={() => fetchActivity(activityPage + 1, true)} className="px-3 py-2 bg-blue-600 rounded text-white">Load more</button>
                    ) : (
                      <button onClick={() => fetchActivity(1)} className="px-3 py-2 bg-slate-100 rounded">Refresh</button>
                    )}
                  </div>
                </div>
              </Motion.div>
            )}

            {activeTab === "Export" && (
              <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-4 rounded">
                    <h4 className="font-semibold mb-2">Export profile</h4>
                    <p className="text-sm text-slate-600 mb-3">Download a PDF copy of your public profile.</p>
                    <div className="flex gap-2">
                      <button onClick={handleExportPdf} className="px-3 py-2 bg-blue-600 text-white rounded inline-flex items-center gap-2"><Download /> Download PDF</button>
                      <button onClick={() => toast("CSV export server-side not implemented")} className="px-3 py-2 bg-slate-100 rounded">Export CSV</button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded">
                    <h4 className="font-semibold mb-2">Danger zone</h4>
                    <p className="text-sm text-slate-600 mb-3">Delete account or revoke sessions (server action required).</p>
                    <div className="flex gap-2">
                      <button onClick={() => toast.error("Protected action: implement backend endpoint")} className="px-3 py-2 bg-red-600 text-white rounded">Delete account</button>
                      <button onClick={() => toast("Sessions revoked (UI only)")} className="px-3 py-2 bg-slate-100 rounded">Revoke sessions</button>
                    </div>
                  </div>
                </div>
              </Motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Crop modal */}
      {cropOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-4 w-[90%] max-w-3xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg">Crop avatar</h3>
              <button onClick={() => setCropOpen(false)} className="p-1"><X /></button>
            </div>

            <div className="relative w-full h-[420px] bg-gray-100">
              <Cropper
                image={rawAvatar}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="mt-3 flex justify-between items-center">
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
              <div className="flex gap-2">
                <button onClick={() => setCropOpen(false)} className="px-3 py-2 bg-slate-100 rounded">Cancel</button>
                <button onClick={applyCropAndUpload} className="px-3 py-2 bg-blue-600 text-white rounded">Use & Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
