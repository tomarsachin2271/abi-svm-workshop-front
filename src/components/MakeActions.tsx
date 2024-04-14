import React from "react";
import { ethers } from "ethers";
import { BiconomySmartAccountV2, createSessionKeyManagerModule, 
  createBatchedSessionRouterModule, DEFAULT_SESSION_KEY_MANAGER_MODULE, 
  DEFAULT_BATCHED_SESSION_ROUTER_MODULE } from "@biconomy/account"
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Console } from "console";

interface props {
  smartAccount: BiconomySmartAccountV2;
  provider: ethers.providers.Provider;
  address: string;
  bicoToken: ethers.Contract | undefined;
  stakingContract: ethers.Contract | undefined;
  abiSVMAddress: string;
  sessionIDs: string[];
  refreshBalances: () => void;
}

const MakeActions: React.FC<props> = ({ 
  smartAccount, 
  provider, 
  address,
  bicoToken,
  stakingContract,
  abiSVMAddress,
  sessionIDs,
  refreshBalances
}) => {


  /** 
   * 
   * BUILD AND SEND USER OP
   * 
  */

  const sendBatchedUserOpWithData = async (
    to: string[],
    data: string[],
    value: string[],
    sessionId: string[],
    message?: string
  ) => {
    if (!address || !smartAccount || !address) {
      alert('Connect wallet first');
      return;
    }

    const toastMessage = message;
    console.log(toastMessage);
    try {
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
      
      // get session key from local storage
      const sessionKeyPrivKey = window.localStorage.getItem("sessionPKey");
      console.log("sessionKeyPrivKey", sessionKeyPrivKey);
      if (!sessionKeyPrivKey) {
        alert("Session key not found please create session");
        return;
      }
      
      // USE SESION KEY AS SIGNER, Provider is passed as its needed check chainId in the sdk
      const sessionSigner = new ethers.Wallet(sessionKeyPrivKey, provider);
      //console.log("sessionSigner", sessionSigner);

      // generate sessionModule
      const sessionModule = await createSessionKeyManagerModule({
        moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
        smartAccountAddress: address,
      });

      const batchedSessionRouterModule = await createBatchedSessionRouterModule({
        moduleAddress: DEFAULT_BATCHED_SESSION_ROUTER_MODULE,
        sessionKeyManagerModule: sessionModule,
        smartAccountAddress: address,
      });
      
      // set active module to sessionModule
      smartAccount = smartAccount.setActiveValidationModule(batchedSessionRouterModule);
      
      // Create array fo tx object based on array of to, value, data
      const txArray = to.map((to, index) => {
        console.log(`Index: ${index} To: ${to} Data: ${data[index]} Value: ${value[index]}`)
        return {
          to: to,
          data: data[index],
          value: value[index],
        }
      });
      const batchSessionParams = sessionId.map((id, index) => {
        console.log(`Index: ${index} Session Id: ${id}`)
        return {
          sessionSigner: sessionSigner,
          sessionValidationModule: abiSVMAddress as `0x${string}`,
          sessionID: id,
        }
      });

      const userOp = await smartAccount.buildUserOp(txArray, {
        params: {
          batchSessionParams: batchSessionParams,
        }
      });

      console.log(userOp);
      // increase verificationGasLimit by 10% to avoid AA40 error
      let verificationGasLimit = userOp.verificationGasLimit;
      if(verificationGasLimit) {
        verificationGasLimit = ethers.BigNumber.from(verificationGasLimit).mul(110).div(100).toHexString() as `0x${string}`;
        userOp.verificationGasLimit = verificationGasLimit
      }
      // send user op
      const userOpResponse = await smartAccount.sendUserOp(userOp, {
          batchSessionParams: batchSessionParams,
      });

      //console.log("userOpHash %o for Session Id %s", userOpResponse, sessionId);

      const { receipt } = await userOpResponse.wait();
      refreshBalances();
      console.log(message + " => Success");
      //console.log("txHash", receipt.transactionHash);
      const explorerLink = `https://sepolia.arbiscan.io/tx/${receipt.transactionHash}`
      console.log("Check tx: ", explorerLink);
      toast.success(<a target="_blank" href={explorerLink}>Success, Click to view transaction</a>, {
        position: "top-right",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        });
    } catch(err: any) {
      console.error(err);
    }
  }

  const sendUserOpWithData = async (
    to: string,
    data: string,
    value: string,
    sessionId: string,
    message?: string
  ) => {
    if (!address || !smartAccount || !address) {
      alert('Connect wallet first');
      return;
    }

    const toastMessage = message;
    console.log(toastMessage);
    try {
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
      
      // get session key from local storage
      const sessionKeyPrivKey = window.localStorage.getItem("sessionPKey");
      console.log("sessionKeyPrivKey", sessionKeyPrivKey);
      if (!sessionKeyPrivKey) {
        alert("Session key not found please create session");
        return;
      }
      
      // USE SESION KEY AS SIGNER, Provider is passed as its needed check chainId in the sdk
      const sessionSigner = new ethers.Wallet(sessionKeyPrivKey, provider);
      //console.log("sessionSigner", sessionSigner);

      // generate sessionModule
      const sessionModule = await createSessionKeyManagerModule({
        moduleAddress: DEFAULT_SESSION_KEY_MANAGER_MODULE,
        smartAccountAddress: address,
      });
      
      // set active module to sessionModule
      smartAccount = smartAccount.setActiveValidationModule(sessionModule);
      
      const tx = {
        to: to, 
        data: data,
        value: value,
      };
      // send user op
      const userOpResponse = await smartAccount.sendTransaction(tx, {
        params: {
          sessionSigner: sessionSigner,
          sessionValidationModule: abiSVMAddress as `0x${string}`,
          sessionID: sessionId,
        }
      });

      //console.log("userOpHash %o for Session Id %s", userOpResponse, sessionId);

      const { receipt } = await userOpResponse.wait();
      refreshBalances();
      console.log(message + " => Success");
      //console.log("txHash", receipt.transactionHash);
      const explorerLink = `https://sepolia.arbiscan.io/tx/${receipt.transactionHash}`
      console.log("Check tx: ", explorerLink);
      toast.success(<a target="_blank" href={explorerLink}>Success, Click to view transaction</a>, {
        position: "top-right",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
        });
    } catch(err: any) {
      console.error(err);
    }
  }


    return(
      <div className="styles.card">
          {/* { bicoToken && stakingContract &&
            <div style={{ padding: '10px' }}>
              <button className="button-highlight" onClick={async() => {
                  const { data } = await bicoToken.populateTransaction.approve(
                    stakingContract?.address, // spender address
                    ethers.utils.parseUnits("500".toString(), 18)
                  );
                  if(data) {
                    await sendUserOpWithData(bicoToken.address, data, "0", sessionIDs[0], "Approving BICO to Staking Contract");
                  } else {
                    toast.error("Error approving BICO to Staking Contract. Data is undefined");
                  }
                }
              }>Approve</button>
            </div>
          }
          { bicoToken && stakingContract &&
            <div style={{ padding: '10px' }}>
              <button className="button-highlight" onClick={async() => {
                  const { data } = await stakingContract.populateTransaction.stake(
                    address,
                    ethers.utils.parseUnits("500".toString(), 18)
                  );
                  if(data) {
                    await sendUserOpWithData(stakingContract.address, data, "0", sessionIDs[1], "Staking BICO to Staking Contract");
                  } else {
                    toast.error("Error staking BICO to Staking Contract. Data is undefined");
                  }
                }
              }>Stake BICO</button>
            </div>
          } */}
          {bicoToken && stakingContract &&
            <div style={{ padding: '10px' }}>
              <button className="button-highlight" onClick={async() => {
                  const { data: approveData } = await bicoToken.populateTransaction.approve(
                    stakingContract?.address, // spender address
                    ethers.utils.parseUnits("500", 18)
                  );
                  const { data: stakeData } = await stakingContract.populateTransaction.stake(
                    address,
                    ethers.utils.parseUnits("500", 18)
                  );
                  if(approveData && stakeData) {
                    const to = stakingContract.address;
                    const value = "0";
                    await sendBatchedUserOpWithData([bicoToken.address, to], [approveData, stakeData], [value, value], [sessionIDs[0], sessionIDs[1]], "Approve & Deposit BICO");
                  } else {
                    toast.error("Error approving and staking BICO to Staking Contract. Data is undefined");
                  }
                }
              }>Approve and Stake BICO (1 Click)</button>
            </div>
          }
          { bicoToken && stakingContract &&
            <div style={{ padding: '10px' }}>
              <button className="button-highlight" onClick={async() => {
                  const rewardsEarned = await stakingContract.getTotalRewardsBalance(address);
                  const { data } = await stakingContract.populateTransaction.claimRewards(
                    address,
                    rewardsEarned
                  );
                  console.log(`Claiming ${ethers.utils.formatUnits(rewardsEarned, 18)} BICO Rewards`)
                  if(data) {
                    await sendUserOpWithData(stakingContract.address, data, "0", sessionIDs[2], "Claim Rewrads from Staking Contract");
                  } else {
                    toast.error("Error claiming rewards from Staking Contract. Data is undefined");
                  }
                }
              }>Claim Rewards</button>
            </div>
          }
        </div>
    )
  }
  
  export default MakeActions;
