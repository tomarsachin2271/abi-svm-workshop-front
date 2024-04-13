import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";

interface UserOperationStruct {
    sender: string;
    nonce: BigNumberish;
    initCode: BytesLike | "0x";
    callData: BytesLike;
    callGasLimit?: BigNumberish;
    verificationGasLimit?: BigNumberish;
    preVerificationGas?: BigNumberish;
    maxFeePerGas?: BigNumberish;
    maxPriorityFeePerGas?: BigNumberish;
    paymasterAndData: BytesLike | "0x";
    signature: BytesLike;
  }
  
export async function getCurrentBaseFee(provider: ethers.providers.Provider): Promise<string> {
    const block = await provider.getBlock('latest');
    console.log(block);
    return block.baseFeePerGas?.toString() ?? '0';
}

// Function that accepts partial UserOperation and calculates the transction fee  needed for the operation
export const calculateGasFee = (userOp: Partial<UserOperationStruct>, baseGasFee: string): string => {
    if(userOp.verificationGasLimit && userOp.preVerificationGas && userOp.callGasLimit && userOp.maxFeePerGas && userOp.maxPriorityFeePerGas) {
        const {maxFeePerGas, maxPriorityFeePerGas, callGasLimit, verificationGasLimit, preVerificationGas} = userOp;

        let gasPrice: BigNumber;
        if (maxFeePerGas === maxPriorityFeePerGas) {
            // Legacy mode (for networks that don't support the basefee opcode)
            gasPrice = BigNumber.from(maxFeePerGas);
        } else {
            const tempGasPrice = BigNumber.from(baseGasFee).add(maxPriorityFeePerGas);
            gasPrice = tempGasPrice.gt(maxFeePerGas) ? BigNumber.from(maxFeePerGas) : tempGasPrice;
        }

        const gasLimit = BigNumber.from(callGasLimit).add(verificationGasLimit).add(preVerificationGas);

        // calculate the gas fee
        return gasPrice.mul(gasLimit).toString();
    }
    throw new Error("Incomplete UserOperation");
};