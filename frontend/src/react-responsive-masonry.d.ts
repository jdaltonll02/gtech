declare module 'react-responsive-masonry' {
  import { ReactNode } from 'react';

  interface MasonryProps {
    columnsCount?: number;
    gutter?: string;
    children?: ReactNode;
  }

  export default function Masonry(props: MasonryProps): JSX.Element;
}
