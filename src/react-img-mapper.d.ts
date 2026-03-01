import React from 'react';

export interface Area {
  id: string;
  shape: "circle" | "rect" | "poly";
  coords: number[];
  preFillColor: string;
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  active: boolean;
  disabled: boolean;
}

export interface ImgMap {
  name: string;
  areas: Area[];
}

export type ImageEventHandler = (
  area: Area,
  index: number,
  event: React.MouseEvent<HTMLImageElement>
) => void;

export interface ImageMapperProps {
  src: string;
  map: ImgMap;
  onImageClick?: ImageEventHandler;
  parentRef?: React.RefObject<HTMLElement | null>;
  width?: number;
  imgWidth?: number;
  imgHeight?: number;
  responsive?: boolean;
  onLoad?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

declare const ImageMapper: React.FC<ImageMapperProps>;
export default ImageMapper;
