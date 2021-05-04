interface Partition {
  binary: Uint8Array;
  offset: number;
  filename: string;
  load():Promise<boolean>;
}

type BaudRate = 115200 | 230400 | 460800 | 921600;

interface StreamTarget {
  receive(data: Uint8Array) : void;
}