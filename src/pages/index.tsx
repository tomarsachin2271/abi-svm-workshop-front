import Head from "next/head";
import styles from "@/styles/Home.module.css";
import { useState, useEffect } from "react";
import { BiconomySmartAccountV2, BiconomySmartAccountV2Config, createSmartAccountClient, DEFAULT_BATCHED_SESSION_ROUTER_MODULE
 } from "@biconomy/account";
import { Contract, ethers } from "ethers";
import CreateSession from "@/components/CreateSession";
import erc20Abi from "@/utils/erc20Abi.json";
import stakingContractAbi from "@/utils/stakingContractAbi.json";

const bundlerURL = "https://bundler.biconomy.io/api/v2/421614/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44";

const biconomyPaymasterApiKey = "5AiWCxQOz.e918688d-7c2a-4cbf-a226-ae6f04536d6c";

export default function Home() {
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [smartAccount, setSmartAccount] = useState<BiconomySmartAccountV2 | null>(null);
  const [provider, setProvider] = useState<ethers.providers.Provider | null>(null);
  const [countdown, setCountdown] = useState(15);

  const [bicoToken, setBicoToken] = useState<Contract>();
  const [stakingContract, setStakingContract] = useState<Contract>();

  const [bicoBalance, setBicoBalance] = useState<string>("0");
  const [tokenAllowance, setTokenAllowance] = useState<string>("0");
  const [stakedBalance, setStakedBalance] = useState<string>("0");
  const [rewardsEarned, setRewardsEarned] = useState<string>("0");
  const [nativeBalance, setNativeBalance] = useState<string>("0");
  const [abiSVMAddress, setAbiSVMAddress] = useState<string>("0x000006bC2eCdAe38113929293d241Cf252D91861");

  const refreshBalances = async () => {
    if (bicoToken && stakingContract) {
      try {
        console.log("Refreshing Balances");

        const nativeBalance = await provider?.getBalance(address);
        if (nativeBalance) {
          setNativeBalance(ethers.utils.formatUnits(nativeBalance, 18).slice(0, 7));
        }

        const accTokenABalance = await bicoToken.balanceOf(address);
        setBicoBalance(ethers.utils.formatUnits(accTokenABalance, 18));

        const stakingTokenAllowance = await bicoToken.allowance(address, stakingContract.address);
        setTokenAllowance(ethers.utils.formatUnits(stakingTokenAllowance, 18));

        const stakedBalance = await stakingContract.balanceOf(address);
        setStakedBalance(ethers.utils.formatUnits(stakedBalance, 18));

        const rewardsEarned = await stakingContract.getTotalRewardsBalance(address);
        setRewardsEarned(ethers.utils.formatUnits(rewardsEarned, 18));
      } catch (err: any) {
        console.error(err);
      }
    } else {
      console.log("Bico Token or Staking Contract not initialized");
    }
  };

  useEffect(() => {
    let intervalId: any, countdownId: any;
    if (bicoToken && stakingContract) {
      intervalId = setInterval(() => {
        console.log("Refreshing balances every 15 seconds");
        refreshBalances(); // Call your function to refresh balances
        setCountdown(15); // Reset countdown after each refresh
      }, 15000); // 15000 milliseconds = 15 seconds

      // Interval for countdown decrement
      countdownId = setInterval(() => {
        setCountdown((prevCount) => prevCount - 1);
      }, 1000); // Update countdown every second
    }

    // Cleanup function to clear the interval when component unmounts
    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [bicoToken, stakingContract]);

  useEffect(() => {
    refreshBalances();
  }, [address, smartAccount, provider]);

  const connect = async () => {
    // @ts-ignore
    const { ethereum } = window;
    try {
      setLoading(true);
      const provider = new ethers.providers.Web3Provider(ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      const biconomySmartAccountConfig: BiconomySmartAccountV2Config = {
        signer: signer,
        bundlerUrl: bundlerURL,
        biconomyPaymasterApiKey: biconomyPaymasterApiKey,
      };
      setProvider(provider);
      const smartAccount = await createSmartAccountClient(biconomySmartAccountConfig);
      setAddress(await smartAccount.getAccountAddress());
      setSmartAccount(smartAccount);

      let enabledModule = await smartAccount.getAllModules();
      console.log(enabledModule);
      console.log(`Batched Session Router Module: ${DEFAULT_BATCHED_SESSION_ROUTER_MODULE}`);

      const bicoToken = new ethers.Contract("0x48d3E8EDd4cdD81E4B4eea678Ab167E1988B63F2", erc20Abi, provider);
      setBicoToken(bicoToken);
      const bicoStakingContract = new ethers.Contract(
        "0x0BcbdD5fA8F61a1D09f2373D1FDA3EdEfB25cDEc",
        stakingContractAbi,
        provider
      );
      setStakingContract(bicoStakingContract);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <Head>
        <title>Session Keys</title>
        <meta name="description" content="Build a dApp powered by session keys" />
      </Head>
      <main className={styles.main}>
        <h1 style={{
          textAlign: "center",
        }}>ABI SVM Demo</h1>
        {!loading && !address && (
          <button onClick={connect} className={styles.connect}>
            Connect to Web3
          </button>
        )}
        {loading && <p>Loading Smart Account...</p>}

        {address && (
          <div className={styles.infoCard}>
            <h2 className={styles.infoTitle}>Smart Account</h2>
            <p className={styles.infoContent}>Address: {address}</p>
            {nativeBalance && <p className={styles.infoContent}>Balance: {nativeBalance} ETH</p>}
          </div>
        )}
        <div className={styles.cardsContainer}>
          {smartAccount && provider &&
            <div className={styles.balanceCard}>
              <h2>Balances</h2>
              <p>BICO Balance: {bicoBalance}</p>
              <p>Token Allowance: {tokenAllowance}</p>
              <p>Staked Amount: {stakedBalance}</p>
              <p>Rewards Earned: {rewardsEarned}</p>
              {bicoToken && <p>Update in: {countdown} seconds</p>}
              <button onClick={refreshBalances} className={styles.refreshButton}>
                Refresh
              </button>
            </div>
          }
          {smartAccount && provider && (
            <div className={`${styles.card} ${styles.dynamicCard}`}>
              <CreateSession
                smartAccount={smartAccount}
                address={address}
                provider={provider}
                bicoToken={bicoToken}
                stakingContract={stakingContract}
                abiSVMAddress={abiSVMAddress}
                refreshBalances={refreshBalances}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
