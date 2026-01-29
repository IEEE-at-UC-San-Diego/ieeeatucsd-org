import React, { useState, useEffect, useMemo } from "react";
import { X, Upload, Trash2, ExternalLink, Plus } from "lucide-react";
import type { Link } from "../../../shared/types/firestore";
import { PRESET_CATEGORIES } from "../utils/linkPermissions";
import { uploadFilesForEvent } from "../../manage-events/utils/fileUploadUtils";
import { Timestamp } from "firebase/firestore";
import { showToast } from "../../../shared/utils/toast";

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (linkData: {
    url: string;
    title: string;
    category: string;
    description?: string;
    iconUrl?: string;
    shortUrl?: string;
    publishDate?: Timestamp | null;
    expireDate?: Timestamp | null;
  }) => void;
  editingLink: (Link & { id: string }) | null;
  loading?: boolean;
  allLinks?: (Link & { id: string })[]; // All existing links for extracting custom categories
}

export default function LinkModal({
  isOpen,
  onClose,
  onSave,
  editingLink,
  loading = false,
  allLinks = [],
}: LinkModalProps) {
  const [formData, setFormData] = useState({
    url: "",
    title: "",
    category: "General",
    description: "",
    iconUrl: "",
    shortUrl: "",
    publishDate: "",
    expireDate: "",
  });

  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string>("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  // Extract unique custom categories from existing links and merge with presets
  const availableCategories = useMemo(() => {
    // Get all unique categories from existing links
    const existingCategories = new Set(
      allLinks.map((link) => link.category).filter(Boolean)
    );

    // Convert preset categories to a Set for deduplication
    const presetSet = new Set(PRESET_CATEGORIES);

    // Find custom categories (those not in presets)
    const customCategories = Array.from(existingCategories).filter(
      (cat) => !presetSet.has(cat as any)
    );

    // Combine presets with custom categories and sort alphabetically
    const combined = [
      ...PRESET_CATEGORIES,
      ...customCategories.sort((a, b) => a.localeCompare(b)),
    ];

    return combined;
  }, [allLinks]);

  // Helper to convert Timestamp to datetime-local string
  const timestampToDatetimeLocal = (timestamp?: any): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Initialize form data when editing
  useEffect(() => {
    if (editingLink) {
      // Check if the category exists in available categories (presets + existing custom)
      const categoryExists = availableCategories.includes(editingLink.category);

      setFormData({
        url: editingLink.url,
        title: editingLink.title,
        category: categoryExists ? editingLink.category : "custom",
        description: editingLink.description || "",
        iconUrl: editingLink.iconUrl || "",
        shortUrl: editingLink.shortUrl || "",
        publishDate: timestampToDatetimeLocal(editingLink.publishDate),
        expireDate: timestampToDatetimeLocal(editingLink.expireDate),
      });
      setIconPreview(editingLink.iconUrl || "");
      setIsCustomCategory(!categoryExists);
      setCustomCategoryInput(categoryExists ? "" : editingLink.category);
    } else {
      setFormData({
        url: "",
        title: "",
        category: "General",
        description: "",
        iconUrl: "",
        shortUrl: "",
        publishDate: "",
        expireDate: "",
      });
      setIconPreview("");
      setIsCustomCategory(false);
      setCustomCategoryInput("");
    }
    setIconFile(null);
    setErrors({});
  }, [editingLink, isOpen, availableCategories]);

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrors({ ...errors, icon: "Please select an image file" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors({ ...errors, icon: "Image must be less than 2MB" });
      return;
    }

    setIconFile(file);
    setErrors({ ...errors, icon: "" });

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview("");
    setFormData({ ...formData, iconUrl: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const newErrors: Record<string, string> = {};

    if (!formData.url.trim()) {
      newErrors.url = "URL is required";
    } else if (!validateUrl(formData.url)) {
      newErrors.url = "Please enter a valid URL";
    }

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    }

    // Validate short URL
    if (formData.shortUrl.trim()) {
      const slug = formData.shortUrl.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slug)) {
        newErrors.shortUrl =
          "Short URL must contain only lowercase letters, numbers, and hyphens";
      } else if (slug.length < 2) {
        newErrors.shortUrl = "Short URL must be at least 2 characters";
      } else if (slug.length > 50) {
        newErrors.shortUrl = "Short URL must be less than 50 characters";
      } else {
        // Check for uniqueness (only if not editing or if slug changed)
        const existingLinkWithSlug = allLinks.find(
          (link) =>
            link.shortUrl === slug &&
            (!editingLink || link.id !== editingLink.id)
        );
        if (existingLinkWithSlug) {
          newErrors.shortUrl = "This short URL is already taken";
        }
      }
    }

    // Validate category
    const finalCategory = isCustomCategory
      ? customCategoryInput.trim()
      : formData.category;

    if (!finalCategory) {
      newErrors.category = isCustomCategory
        ? "Please enter a custom category name"
        : "Category is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      let iconUrl = formData.iconUrl;

      // Upload icon if a new file was selected
      if (iconFile) {
        setUploadingIcon(true);
        const uploadedUrls = await uploadFilesForEvent(
          [iconFile],
          "link-icons",
          "icons"
        );
        iconUrl = uploadedUrls[0];
        setUploadingIcon(false);
      }

      // Build save data
      const saveData: any = {
        url: formData.url.trim(),
        title: formData.title.trim(),
        category: finalCategory,
      };

      // Only include optional fields if they have values
      const description = formData.description.trim();
      if (description) {
        saveData.description = description;
      }

      const shortUrl = formData.shortUrl.trim();
      if (shortUrl) {
        saveData.shortUrl = shortUrl;
      }

      if (iconUrl) {
        saveData.iconUrl = iconUrl;
      }

      // Convert datetime-local strings to Timestamps or null if cleared
      if (formData.publishDate) {
        saveData.publishDate = Timestamp.fromDate(
          new Date(formData.publishDate)
        );
      } else if (editingLink && editingLink.publishDate) {
        saveData.publishDate = null;
      }

      if (formData.expireDate) {
        saveData.expireDate = Timestamp.fromDate(new Date(formData.expireDate));
      } else if (editingLink && editingLink.expireDate) {
        saveData.expireDate = null;
      }

      onSave(saveData);

      // Reset form
      setFormData({
        url: "",
        title: "",
        category: "General",
        description: "",
        iconUrl: "",
        shortUrl: "",
        publishDate: "",
        expireDate: "",
      });
      setIconFile(null);
      setIconPreview("");
      setIsCustomCategory(false);
      setCustomCategoryInput("");
      setErrors({});
    } catch (error) {
      console.error("Error saving link:", error);
      showToast.error("Failed to save link. Please try again.");
      setUploadingIcon(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header - Fixed */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {editingLink ? "Edit Link" : "Create New Link"}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              fill in the details below to {editingLink ? "update" : "create"} a
              link
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all duration-200"
            disabled={loading || uploadingIcon}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Info Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Main Information
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 ">
                    Link Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g. Weekly Meeting Zoom"
                    className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${errors.title ? "border-red-500 bg-red-50/50" : "border-gray-200"
                      }`}
                    disabled={loading || uploadingIcon}
                  />
                  {errors.title && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500" /> {errors.title}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={isCustomCategory ? "custom" : formData.category}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "custom") {
                          setIsCustomCategory(true);
                          setFormData({ ...formData, category: "" });
                        } else {
                          setIsCustomCategory(false);
                          setCustomCategoryInput("");
                          setFormData({ ...formData, category: value });
                        }
                      }}
                      className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 appearance-none ${errors.category ? "border-red-500 bg-red-50/50" : "border-gray-200"
                        }`}
                      disabled={loading || uploadingIcon}
                    >
                      {PRESET_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                      {availableCategories
                        .filter(
                          (cat) => !PRESET_CATEGORIES.includes(cat as any)
                        )
                        .map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      <option value="custom">+ Create Custom Category</option>
                    </select>
                    {/* Select Arrow Icon */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {isCustomCategory && (
                    <div className="mt-2 flex gap-2 animate-in slide-in-from-top-2 duration-200">
                      <input
                        type="text"
                        value={customCategoryInput}
                        onChange={(e) =>
                          setCustomCategoryInput(e.target.value)
                        }
                        placeholder="New category name..."
                        className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(false);
                          setCustomCategoryInput("");
                          setFormData({ ...formData, category: "General" });
                        }}
                        className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {errors.category && (
                    <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-red-500" /> {errors.category}
                    </p>
                  )}
                </div>
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Destination URL <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://example.com/resource"
                    className={`w-full px-4 py-2.5 pl-10 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${errors.url ? "border-red-500 bg-red-50/50" : "border-gray-200"
                      }`}
                    disabled={loading || uploadingIcon}
                  />
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  {formData.url && validateUrl(formData.url) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                  )}
                </div>
                {errors.url && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500" /> {errors.url}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Add a brief description about this link..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-all duration-200"
                  disabled={loading || uploadingIcon}
                />
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            {/* Advanced Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                Advanced Settings
              </h4>

              {/* Short URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Custom Short Link
                </label>
                <div className="flex group">
                  <span className="inline-flex items-center px-4 py-2.5 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm font-medium rounded-l-xl select-none">
                    ieeeatucsd.org/
                  </span>
                  <input
                    type="text"
                    value={formData.shortUrl}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shortUrl: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                    placeholder="custom-alias"
                    className={`flex-1 px-4 py-2.5 border rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 ${errors.shortUrl ? "border-red-500 bg-red-50/50" : "border-gray-200"
                      }`}
                    disabled={loading || uploadingIcon}
                  />
                </div>
                {errors.shortUrl ? (
                  <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500" /> {errors.shortUrl}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1.5 ml-1">
                    Only lowercase letters, numbers, and hyphens allowed.
                  </p>
                )}
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Publish Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.publishDate}
                    onChange={(e) =>
                      setFormData({ ...formData, publishDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-gray-600"
                    disabled={loading || uploadingIcon}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Expiration Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expireDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expireDate: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-gray-600"
                    disabled={loading || uploadingIcon}
                  />
                </div>
              </div>

              {/* Icon Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Icon
                </label>

                <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-200">
                  {iconPreview ? (
                    <div className="flex items-center gap-5">
                      <div className="relative group">
                        <img
                          src={iconPreview}
                          alt="Icon preview"
                          className="w-16 h-16 rounded-xl object-cover shadow-sm bg-white ring-2 ring-white"
                        />
                        <div className="absolute inset-0 bg-black/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium text-gray-900">Icon Selected</span>
                        <button
                          type="button"
                          onClick={handleRemoveIcon}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors w-fit flex items-center gap-1.5"
                          disabled={loading || uploadingIcon}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Icon
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleIconChange}
                        className="hidden"
                        id="icon-upload"
                        disabled={loading || uploadingIcon}
                      />
                      <label
                        htmlFor="icon-upload"
                        className="cursor-pointer flex flex-col items-center py-2"
                      >
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          Click to upload an image
                        </span>
                        <span className="text-xs text-gray-400 mt-1">
                          PNG, JPG up to 2MB
                        </span>
                      </label>
                    </>
                  )}
                </div>
                {errors.icon && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-red-500" /> {errors.icon}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer - Fixed */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            disabled={loading || uploadingIcon}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || uploadingIcon}
            className="px-6 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-black transition-all duration-200 shadow-lg shadow-gray-900/10 hover:shadow-xl hover:shadow-gray-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploadingIcon ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                {editingLink ? "Save Changes" : "Create Link"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

