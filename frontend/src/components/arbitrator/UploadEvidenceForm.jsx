/**
 * UploadEvidenceForm.jsx
 * ------------------------------------------------------------
 * 🔹 Purpose:
 *   Secure, user-friendly upload interface for Evidence files
 *   tied to an Arbitration or Case.
 *
 * Features:
 *  ✅ Secure upload via backend (Multer + AWS S3/local)
 *  ✅ Upload progress bar + success feedback
 *  ✅ Category, title, and description metadata
 *  ✅ Frontend file validation
 *  ✅ Fully responsive and production-ready
 */

import React, { useState } from "react";
import axios from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, File, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function UploadEvidenceForm({ arbitrationId, onUploadComplete }) {
  const { toast } = useToast();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Document");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const MAX_SIZE_MB = 50;
  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/zip",
  ];

  const categories = ["Document", "Image", "Video", "Audio", "Other"];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      toast({
        title: "Unsupported File Type",
        description: "Allowed: PDF, DOCX, PNG, JPG, ZIP, TXT.",
        variant: "destructive",
      });
      return;
    }

    if (selectedFile.size / 1024 / 1024 > MAX_SIZE_MB) {
      toast({
        title: "File Too Large",
        description: `Max size is ${MAX_SIZE_MB}MB.`,
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast({
        title: "Missing File",
        description: "Please select a valid file before uploading.",
        variant: "destructive",
      });
      return;
    }

    if (!arbitrationId) {
      toast({
        title: "Missing Arbitration ID",
        description: "This upload must be linked to a valid arbitration.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("description", description);
      formData.append("category", category);

      const { data } = await axios.post(
        `/api/evidence/${arbitrationId}/upload`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (e) => {
            const percent = Math.round((e.loaded * 100) / e.total);
            setProgress(percent);
          },
        }
      );

      toast({
        title: "✅ Upload Successful",
        description: `"${data?.evidence?.title || title}" uploaded successfully.`,
      });

      if (onUploadComplete) onUploadComplete(data.evidence);

      // Reset
      setFile(null);
      setTitle("");
      setDescription("");
      setProgress(0);
    } catch (err) {
      console.error("❌ Upload error:", err);
      toast({
        title: "Upload Failed",
        description:
          err?.response?.data?.message || "Unable to upload evidence at this time.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Upload className="h-5 w-5" /> Upload Evidence
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Witness Statement, Contract Copy..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Briefly describe this evidence..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
            >
              {categories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="file">File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.zip"
              onChange={handleFileChange}
              required
            />
            {file && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 flex items-center gap-2">
                <File className="h-4 w-4" /> {file.name}
              </p>
            )}
          </div>

          {uploading && (
            <div className="pt-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500 mt-1 text-center">{progress}% uploaded</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" /> Upload Evidence
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center w-full">
          Supported: PDF, DOCX, PNG, JPG, ZIP, TXT (max {MAX_SIZE_MB}MB)
        </p>
      </CardFooter>
    </Card>
  );
}
