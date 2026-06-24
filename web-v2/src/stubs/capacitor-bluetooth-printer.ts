/** Web/Vercel build stub — real plugin is used only in Capacitor native shells. */
export const BluetoothPrinter = {
  async connect(_opts: { address: string }): Promise<void> {},
  async disconnect(): Promise<void> {},
  async list(): Promise<{ devices: { name?: string; address: string }[] }> {
    return { devices: [] };
  },
  async print(_opts: { data: string | Uint8Array }): Promise<void> {},
};
