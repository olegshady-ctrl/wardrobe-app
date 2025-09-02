"use client";

// lib/cloudinaryUpload.ts
export async function uploadToCloudinary(file: File | Blob | string): Promise<string> {
  const form = new FormData();
  form.append("file", file as any); // dataURL теж працює
  form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
  return json.secure_url as string;
}
