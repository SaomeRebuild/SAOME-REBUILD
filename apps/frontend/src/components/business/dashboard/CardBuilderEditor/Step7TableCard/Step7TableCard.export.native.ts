/**
 * Step7TableCard.export — React Native stub.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.export.native
 * @description RN throw stub per Rule 024 § Hook Split Pattern. RN will
 * need a Skia-based rasterizer (e.g. `react-native-skia` provides
 * `makeImageSnapshot()` for View-to-PNG conversion).
 */

import type { RasterizeOptions } from './Step7TableCard.export.web';

export async function rasterizeTableCard(_opts: RasterizeOptions): Promise<Blob> {
  throw new Error(
    '[Step7TableCard.export.native] rasterizeTableCard not yet implemented on React Native. ' +
      'Use react-native-skia makeImageSnapshot() or expo-print for the A4 export.',
  );
}

export default rasterizeTableCard;
