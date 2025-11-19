// src/components/ResponsiveImage.jsx
import React from "react";

/**
 * Simple ResponsiveImage helper
 * - src: path to image (public path, e.g. /images/1.jpg)
 * - alt: required
 * - className: optional
 * - width/height: optional numbers to avoid layout shift
 * - priority: boolean -> if true, loading="eager"
 */
export default function ResponsiveImage({
  src,
  alt,
  className = "",
  width,
  height,
  priority = false,
  style = {},
}) {
  const loading = priority ? "eager" : "lazy";

  // If width/height provided we set them on the img; if not, rely on CSS aspect-ratio.
  const imgProps = {};
  if (width) imgProps.width = width;
  if (height) imgProps.height = height;

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      className={className}
      style={style}
      {...imgProps}
    />
  );
}
