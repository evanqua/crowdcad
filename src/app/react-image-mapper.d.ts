declare module 'react-img-mapper' {

  export interface Area {
    id: string;
    shape: "circle" | "rect" | "poly";
    coords: number[];
    preFillColor?: string;
    fillColor?: string;
    strokeColor?: string;
    lineWidth?: number;
    active?: boolean;
    disabled?: boolean;
  }

  export interface Map {
    name: string;
    areas: Area[];
  }

  export interface ImageMapperProps {
    src: string;
    map: Map;
    onImageClick?: (
        area: Area,
        index: number,
        event: React.MouseEvent<HTMLImageElement>
        ) => void;
    parentRef?: React.RefObject<HTMLElement | null>;
    width?: number;
    imgWidth?: number;
    imgHeight?: number;
    responsive?: boolean;
    onLoad?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  const ImageMapper: React.FC<ImageMapperProps>;
  export default ImageMapper;
}