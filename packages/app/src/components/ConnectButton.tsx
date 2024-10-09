export default function ConnectButton() {
  return (
    <div>
      <w3m-button 
        loadingLabel="waiting"
        size="md"
        label="Connect Wallet"
      />
      <w3m-network-button />
    </div>
  );
}

