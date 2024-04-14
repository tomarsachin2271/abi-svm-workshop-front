import React, { useEffect, useState } from "react";
import { BigNumber, ethers } from "ethers";
import {
  BiconomySmartAccountV2,
  createBatchedSessionRouterModule,
  createSessionKeyManagerModule,
  DEFAULT_BATCHED_SESSION_ROUTER_MODULE,
  DEFAULT_SESSION_KEY_MANAGER_MODULE,
} from "@biconomy/account";
import MakeActions from "./MakeActions";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  APPROVE_BICO_SESSION_ID,
  CLAIM_REWARDS_SESSION_ID,
  getABISVMSessionKeyData,
  STAKE_BICO_SESSION_ID,
} from "@/utils/sessionKey";
import { calculateGasFee, getCurrentBaseFee } from "@/utils/gasFeeUtils";

interface props {
  smartAccount: BiconomySmartAccountV2;
  address: string;
  provider: ethers.providers.Provider;
  bicoToken: ethers.Contract | undefined;
  stakingContract: ethers.Contract | undefined;
  abiSVMAddress: string;
  refreshBalances: () => void;
}

const CreateSession: React.FC<props> = ({
  smartAccount,
  address,
  provider,
  bicoToken,
  stakingContract,
  abiSVMAddress,
  refreshBalances,
}) => {
  const [isSessionKeyModuleEnabled, setIsSessionKeyModuleEnabled] = useState<boolean>(false);
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  // Check if Batched Session Router moudle is enabled
  const [isBSREnabled, setIsBSREnabled] = useState(false);
  const [sessionIDs, setSessionIDs] = useState<string[]>([]);

  useEffect(() => {
    let checkSessionModuleEnabled = async () => {
      if (!address || !smartAccount || !provider) {
        setIsSessionKeyModuleEnabled(false);
        return;
      }
      try {
        const isEnabled = await smartAccount.isModuleEnabled(DEFAULT_SESSION_KEY_MANAGER_MODULE);
        console.log("isSessionKeyModuleEnabled", isEnabled);
        setIsSessionKeyModuleEnabled(isEnabled);
      } catch (err: any) {
        console.error(err);
        setIsSessionKeyModuleEnabled(false);
        return;
      }
      try {
        const isEnabled = await smartAccount.isModuleEnabled(DEFAULT_BATCHED_SESSION_ROUTER_MODULE)
        console.log("isBatchedSessionRouterModuleEnabled", isEnabled);
        setIsBSREnabled(isEnabled);
        return;
      } catch(err: any) {
        console.error(err)
        setIsBSREnabled(false);
        return;
      }
    };
    checkSessionModuleEnabled();
  }, [isSessionKeyModuleEnabled, isBSREnabled, address, smartAccount, provider]);

  useEffect(() => {
    let checkSessionActive = async () => {
      if (!address || !smartAccount || !provider) {
        setIsSessionActive(false);
        return;
      }
      if (isSessionKeyModuleEnabled === false || isBSREnabled === false) {
        setIsSessionActive(false);
        return;
      }

      try {
        const sessionKeyManagerModule = await createSessionKeyManagerModule({
          moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
          smartAccountAddress: address,
        });
        const activeSessions = await sessionKeyManagerModule.sessionStorageClient.getAllSessionData({
          status: "ACTIVE",
        });
        console.log("Active Sessions", activeSessions);

        setSessionIDs(activeSessions.map((session) => session.sessionID || ""));
        let approveBicoSession = false;
        let stakeBicoSession = false;
        let claimRewardsSession = false;
        for (const session of activeSessions) {
          if (session.sessionID === APPROVE_BICO_SESSION_ID) {
            approveBicoSession = true;
          }
          if (session.sessionID === STAKE_BICO_SESSION_ID) {
            stakeBicoSession = true;
          }
          if (session.sessionID === CLAIM_REWARDS_SESSION_ID) {
            claimRewardsSession = true;
          }
        }

        if (activeSessions.length > 0 && approveBicoSession && stakeBicoSession && claimRewardsSession) {
          setIsSessionActive(true);
        } else {
          setIsSessionActive(false);
        }
        return;
      } catch (err: any) {
        console.error(err);
        setIsSessionActive(false);
        return;
      }
    };
    checkSessionActive();
  }, [address, isSessionKeyModuleEnabled, isBSREnabled,  provider, smartAccount]);

  const createSession = async (enableSessionKeyModule: boolean) => {
    const toastMessage = "Creating Sessions for " + address;
    toast.info(toastMessage, {
      position: "top-right",
      autoClose: 15000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
    });
    if (!address || !smartAccount || !provider) {
      alert("Please connect wallet first");
    }
    try {
      // -----> setMerkle tree tx flow
      // create dapp side session key
      const sessionSigner = ethers.Wallet.createRandom();
      const sessionKeyEOA = await sessionSigner.getAddress();
      console.log("sessionKeyEOA", sessionKeyEOA);
      // BREWARE JUST FOR DEMO: update local storage with session key
      window.localStorage.setItem("sessionPKey", sessionSigner.privateKey);

      // generate sessionModule
      const sessionModule = await createSessionKeyManagerModule({
        moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
        smartAccountAddress: address,
      });

      // generate batched session router module
      const sessionRouterModule = await createBatchedSessionRouterModule({
        moduleAddress: DEFAULT_BATCHED_SESSION_ROUTER_MODULE,
        sessionKeyManagerModule: sessionModule,
        smartAccountAddress: address,
      });

      /**
       * Create Session Key Datas
       */

      let sessionKeyDatas = [];

      // // Operation 1: Approve token A to Staking Contract
      const sessionKeyData1 = await getABISVMSessionKeyData(
        sessionKeyEOA,
        {
          destContract: bicoToken?.address || "",
          functionSelector: ethers.utils.hexDataSlice(ethers.utils.id("approve(address,uint256)"), 0, 4), // approve function selector
          valueLimit: ethers.utils.parseEther("0"), // value limit
          // array of offsets, values, and conditions
          rules: [
            {
              offset: 0,
              condition: 0,
              referenceValue: ethers.utils.hexZeroPad(stakingContract?.address || "", 32),
            }, // equal
            {
              offset: 32,
              condition: 1, // less than or equal;
              referenceValue: ethers.utils.hexZeroPad(ethers.utils.parseEther("5000").toHexString(), 32),
            },
          ],
        },
        APPROVE_BICO_SESSION_ID
      );
      sessionKeyDatas.push(sessionKeyData1);

      // Operation 2: Stake Bico Token
      const sessionKeyData2 = await getABISVMSessionKeyData(
        sessionKeyEOA,
        {
          destContract: stakingContract?.address || "",
          functionSelector: ethers.utils.hexDataSlice(ethers.utils.id("stake(address,uint256)"), 0, 4), // stake function selector
          valueLimit: ethers.utils.parseEther("0"), // value limit
          // array of offsets, values, and conditions
          rules: [
            {
              offset: 0,
              condition: 0,
              referenceValue: ethers.utils.hexZeroPad(address || "", 32),
            }, // equal
            {
              offset: 32,
              condition: 1,
              referenceValue: ethers.utils.hexZeroPad(ethers.utils.parseEther("5000").toHexString(), 32),
            }, // Less than or equal
          ],
        },
        STAKE_BICO_SESSION_ID
      );
      sessionKeyDatas.push(sessionKeyData2);

      // Operation 3: Claim Rewards
      const sessionKeyData3 = await getABISVMSessionKeyData(
        sessionKeyEOA,
        {
          destContract: stakingContract?.address || "",
          functionSelector: ethers.utils.hexDataSlice(ethers.utils.id("claimRewards(address,uint256)"), 0, 4), // claim function selector
          valueLimit: ethers.utils.parseEther("0"), // value limit
          // array of offsets, values, and conditions
          rules: [
            {
              offset: 0,
              condition: 0,
              referenceValue: ethers.utils.hexZeroPad(address || "", 32),
            }, // equal
            {
              offset: 32,
              condition: 3,
              referenceValue: ethers.utils.hexZeroPad(ethers.utils.parseEther("10").toHexString(), 32),
            },
          ],
        },
        CLAIM_REWARDS_SESSION_ID
      );
      sessionKeyDatas.push(sessionKeyData3);

      const sessionObjects = sessionKeyDatas.map((data) => {
        return {
          validUntil: 0,
          validAfter: 0,
          sessionValidationModule: abiSVMAddress as `0x${string}`,
          sessionPublicKey: sessionKeyEOA as `0x${string}`,
          sessionKeyData: data.sessionKeyData as `0x${string}`,
          preferredSessionId: data.sessionId,
        };
      });
      console.log("Session Objects Created ", sessionObjects);

      /**
       * Create Data for the Session Enabling Transaction
       * We pass an array of session data objects to the createSessionData method
       */
      const sessionTxData = await sessionModule.createSessionData(sessionObjects);
      //console.log("sessionTxData", sessionTxData);
      setSessionIDs([...sessionTxData.sessionIDInfo]);

      console.log("Session IDs", sessionTxData.sessionIDInfo);
      // tx to set session key
      const setSessionTrx = {
        to: DEFAULT_SESSION_KEY_MANAGER_MODULE, // session manager module address
        data: sessionTxData.data,
      };

      const transactionArray = [];

      if (!isSessionKeyModuleEnabled) {
        // -----> enableModule session manager module
        const enableModuleTrx = await smartAccount.getEnableModuleData(DEFAULT_SESSION_KEY_MANAGER_MODULE);
        transactionArray.push(enableModuleTrx);
      }

      if (!isBSREnabled) {
        // -----> enableModule batched session router module
        const enableModuleTrx = await smartAccount.getEnableModuleData(
          DEFAULT_BATCHED_SESSION_ROUTER_MODULE
        );
        transactionArray.push(enableModuleTrx);
      }

      transactionArray.push(setSessionTrx);

      let partialUserOp = await smartAccount.buildUserOp(transactionArray);

      try {
        console.log("Partial User Op", partialUserOp);
        const userOpResponse = await smartAccount.sendUserOp(partialUserOp);

        //console.log(`userOp Hash: ${userOpResponse.userOpHash}`);
        const transactionDetails = await userOpResponse.wait();
        console.log("txHash", transactionDetails.receipt.transactionHash);
        console.log("Sessions Enabled");

        // Update session status in session storage
        console.log(sessionTxData.sessionIDInfo);
        for (const sessionID of sessionTxData.sessionIDInfo) {
          const searchParam = {
            sessionID: sessionID,
          };
          try {
            console.log(`Updating status for session ${sessionID}`);
            await sessionModule.updateSessionStatus(searchParam, "ACTIVE");

            let sessionData = await sessionModule.sessionStorageClient.getSessionData(searchParam);
            console.log(`Updated status for session ${sessionID}. New Staus: ${sessionData.status}`);
          } catch (error) {
            console.error(`Failed to update status for session ${sessionID}:`, error);
          }
        }

        setIsSessionActive(true);
        toast.success(`Success! Sessions created succesfully`, {
          position: "top-right",
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
      } catch (err: any) {
        // if error message contains AA21 didn't pay prefund then show this message
        if (err.message.includes("AA21 didn't pay prefund")) {
          let baseGasFee = await getCurrentBaseFee(provider);
          let transactionFeeNeeded = await calculateGasFee(partialUserOp, baseGasFee);
          // To be on safe side add 10% extra fee
          const increaseFactor = BigNumber.from(110); // Represents 110%
          const baseFactor = BigNumber.from(100); // Represents the base 100%
          let bumpedUpFee = BigNumber.from(transactionFeeNeeded).mul(increaseFactor).div(baseFactor);
          let feeToDisplay = ethers.utils.formatEther(bumpedUpFee);

          console.log(`Transaction Fee Needed ${feeToDisplay} ETH`);
          toast.error(`Error! Please fund your smart account with at least ${feeToDisplay} ETH to create sessions.`, {
            position: "top-right",
            autoClose: 6000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
          });
        } else {
          toast.error(`Error! ${err.message}`, {
            position: "top-right",
            autoClose: 6000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "dark",
          });
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick={true}
        rtl={false}
        pauseOnFocusLoss={false}
        draggable={false}
        pauseOnHover={false}
        theme="dark"
      />
      <h2>Actions</h2>
      {isSessionKeyModuleEnabled && isBSREnabled && !isSessionActive ? (
        <button onClick={() => createSession(false)} className="button-highlight">
          Create Session
        </button>
      ) : (
        <div></div>
      )}
      {(!isSessionKeyModuleEnabled || !isBSREnabled) && !isSessionActive ? (
        <button onClick={() => createSession(true)} className="button-highlight">
          Enable Session Key Module and Create Session
        </button>
      ) : (
        <div></div>
      )}
      {isSessionActive && (
        <MakeActions
          smartAccount={smartAccount}
          provider={provider}
          address={address}
          bicoToken={bicoToken}
          stakingContract={stakingContract}
          abiSVMAddress={abiSVMAddress}
          sessionIDs={sessionIDs}
          refreshBalances={refreshBalances}
        />
      )}
    </div>
  );
};

export default CreateSession;
