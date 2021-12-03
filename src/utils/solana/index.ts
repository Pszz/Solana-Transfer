import BigNumber from 'bignumber.js';
import * as SPL from '@solana/spl-token';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  Cluster,
  Keypair,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
);
interface ITransferProps {
  from: string;
  to: string;
  tokenAddress: string;
  amount: BigNumber;
  decimals: number;
}
const toPublicKey = (key: string) => {
  return new PublicKey(key);
};
class SolWallet {
  private wallet: any = null;
  private connection: Connection;

  constructor(cluster: Cluster) {
    this.connection = new Connection(clusterApiUrl(cluster), 'recent');
  }

  initWallet() {
    // solana钱包插件
    if (window?.solana && this.wallet === null) {
      this.wallet = window?.solana;
    }
  }
  /**
   * 链接钱包
   */
  async handleConnect() {
    this.initWallet();
    if (this.wallet?.isConnected && this.wallet?.publicKey) {
      return {
        isConnected: true,
        publicKey: this.wallet.publicKey.toString(),
      };
    }
    try {
      const _wallet = await this.wallet.connect();
      return {
        isConnected: true,
        publicKey: _wallet.publicKey.toString(),
      };
    } catch (err) {
      return Promise.reject(`Connect error:${err}`);
    }
  }
  /**
   * 断开链接钱包
   */
  async handleDisConnect() {
    try {
      return await this.wallet.disconnect();
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /**
   * 查询当前钱包某个Token余额
   * @param tokenAccount Token账户
   */
  async getTokenBalance(tokenAccount: PublicKey) {
    return await this.connection.getTokenAccountBalance(tokenAccount);
  }
  /**
   * 获取Token Account信息
   * @param tokenAddress Token代币地址
   * @returns Token账户
   */
  async getTokenAccount(
    tokenAddress: PublicKey,
    whoAddress: PublicKey,
  ): Promise<PublicKey> {
    return await SPL.Token.getAssociatedTokenAddress(
      SPL.ASSOCIATED_TOKEN_PROGRAM_ID,
      SPL.TOKEN_PROGRAM_ID,
      tokenAddress,
      whoAddress,
    );
  }
  /**
   * 向钱包发出请求
   * @param instructions 需要签名的结构
   * @param feePayer 手续费支付者
   * @returns Tx
   */
  async sendTransation(
    instructions: TransactionInstruction[],
    feePayer: PublicKey,
  ) {
    const transaction = new Transaction();

    instructions.forEach((v) => {
      transaction.add(v);
    });

    try {
      transaction.feePayer = feePayer;
      transaction.recentBlockhash = (
        await this.connection.getRecentBlockhash('max')
      ).blockhash;
      // 签名
      const sign = await this.wallet.signTransaction(transaction);
      // 发起
      return await this.connection.sendRawTransaction(sign.serialize());
    } catch (err) {
      console.log(err);
      return Promise.reject(`transfer error:${err}`);
    }
  }
  sendRawTransaction = async (
    instructions: TransactionInstruction[],
    feePayer: string,
  ) => {
    const transaction = new Transaction();
    instructions.forEach((instruction) => {
      transaction.add(instruction);
    });
    transaction.recentBlockhash = (
      await this.connection.getRecentBlockhash('max')
    ).blockhash;
    transaction.feePayer = new PublicKey(feePayer);
    const signedTransaction = await this.wallet.signTransaction(transaction);
    const tx = await this.connection.sendRawTransaction(
      signedTransaction.serialize(),
    );
    console.log('tx----------->', tx);
    return tx;
  };
  async createAccountInstructions(
    owner: PublicKey,
    walletAddress: string,
    mint: PublicKey,
    instructions: TransactionInstruction[],
  ) {
    if (!walletAddress) {
      return console.error('not wallet');
    }
    const associatedAddress = await Token.getAssociatedTokenAddress(
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      owner,
    );
    const payer = toPublicKey(walletAddress);

    instructions.push(
      Token.createAssociatedTokenAccountInstruction(
        SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        mint,
        associatedAddress,
        owner,
        payer,
      ),
    );
    return associatedAddress;
  }
  /**
   * Token 转账
   * @param param0
   */
  async transferToken({
    from,
    to,
    amount,
    tokenAddress,
    decimals,
  }: ITransferProps) {
    const _from: PublicKey = new PublicKey(from);
    const transaction = new Transaction();

    const _amount = parseFloat(
      new BigNumber(10)
        .pow(decimals)
        .multipliedBy(amount.toNumber())
        .toFixed(6),
    );
    console.log(
      `from:${from}, to:${to}, amount: ${amount.toNumber()}, _amount: ${_amount}`,
    );
    transaction.feePayer = _from;
    if (!tokenAddress) Promise.reject('tokenAddress Required');
    const ERC20_TOKEN = new PublicKey(tokenAddress);

    const address = _from.toString();
    const mint = ERC20_TOKEN;
    const myAssociatedAddress = await Token.getAssociatedTokenAddress(
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      toPublicKey(address),
    );
    const toAssociatedAddress = await Token.getAssociatedTokenAddress(
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      toPublicKey(to),
    );
    const toAssociatedAccount = await this.connection.getTokenAccountsByOwner(
      toPublicKey(to),
      {
        mint: mint,
      },
    );
    if (!toAssociatedAccount) {
      return console.error('not toAssociatedAccount');
    }
    const instructions: TransactionInstruction[] = [];
    if (toAssociatedAccount.value.length === 0) {
      await this.createAccountInstructions(
        toPublicKey(to),
        address,
        mint,
        instructions,
      );
    }
    if (!toAssociatedAddress) {
      return console.error('error toAssociatedAddress');
    }
    instructions.push(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        myAssociatedAddress,
        toAssociatedAddress,
        toPublicKey(address),
        [],
        _amount,
      ),
    );
    return this.sendRawTransaction(instructions, address);
  }
  /**
   * Transfer
   * @params { from: 转账Token，to：接收Token，amout:金额}
   * @returns
   */
  async transfer(props: ITransferProps) {
    const { from, to, amount, tokenAddress } = props;
    console.log('transfer:', from, to, amount);
    if (!from) {
      return Error('from address error');
    }
    if (!to) {
      return Error('to address error');
    }
    if (amount.toNumber() <= 0) {
      return Error('amount error');
    }
    const _from: PublicKey = new PublicKey(from);
    const _to: PublicKey = new PublicKey(to);

    // 主币和Token区分
    if (!tokenAddress) {
      return this.sendTransation(
        [
          SystemProgram.transfer({
            fromPubkey: _from,
            toPubkey: _to,
            lamports: amount.multipliedBy(1e9).toNumber(),
          }),
        ],
        _from,
      );
    }
    return this.transferToken(props);
  }
}

export default new SolWallet('devnet');
