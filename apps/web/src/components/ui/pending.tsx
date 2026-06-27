import { Center } from "@/components/ui/center";
import { Spinner } from "@/components/ui/spinner";

type PendingProps = {
  message?: string;
};

function Pending(props: PendingProps) {
  return (
    <Center>
      <div className="shimmer flex max-w-80 items-center gap-x-2">
        <Spinner />
        <p>{props.message ?? "Loading..."}</p>
      </div>
    </Center>
  );
}

export { Pending };
