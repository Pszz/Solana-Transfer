import styles from './index.less';
import { Button, Divider, Form, Input, InputNumber, Select } from 'antd';
import SolWallet from '@/utils/solana';
import { useEffect, useState } from 'react';
import BigNumber from 'bignumber.js';

const { Option } = Select;
export default function IndexPage() {
  const [form] = Form.useForm();
  const [connected, setConnected] = useState(false);

  const handleSubmit = ({
    from,
    to,
    amount,
    tokenAddress,
  }: {
    from: string;
    to: string;
    amount: string;
    tokenAddress: string;
  }) => {
    SolWallet.transfer({
      from,
      to,
      tokenAddress,
      amount: new BigNumber(amount),
      decimals: 9,
    });
  };
  const handleConnect = () => {
    SolWallet.handleConnect().then((res) => {
      form.setFieldsValue({ from: res.publicKey });
      setConnected(res.isConnected);
    });
  };

  useEffect(() => {
    handleConnect();
  }, []);

  return (
    <section className={styles['box']}>
      <div>
        <Divider orientation="left">Wallet</Divider>
        {connected ? (
          <Button
            type="primary"
            onClick={() => {
              SolWallet.handleDisConnect();
              setConnected(false);
            }}
            danger
          >
            Disconnect
          </Button>
        ) : (
          <Button type="primary" onClick={handleConnect}>
            Connect
          </Button>
        )}
      </div>
      <div>
        <Divider orientation="left">Transfer</Divider>
        <Form form={form} labelCol={{ span: 8 }} onFinish={handleSubmit}>
          <Form.Item
            name="from"
            label="Form address"
            rules={[
              {
                required: true,
                message: 'No connect to the wallet',
              },
            ]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="to"
            label="To address"
            initialValue="C3hQiUHiRyG3Ts4WiN8WHaEutNR1W1DKEaUTRpq42ifw"
            rules={[
              {
                required: true,
                message: 'input transfer address',
              },
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="tokenAddress" label="Token">
            <Select defaultValue="SOL">
              <Option value="">SOL</Option>
              <Option value="GRZyd5BAUYJP8Ti9jdFnRKF9Fw3GdZQuuZmVh4xXmoSx">
                Token1
              </Option>
              <Option value="BkfWNsq3papRx1JXTxBVtCHmr1UhZGNrXEvDM4UmmGEs">
                LeftCatToken
              </Option>
            </Select>
          </Form.Item>
          <Form.Item label="Transfer amount" name="amount">
            <InputNumber<string>
              style={{ width: 200 }}
              defaultValue="0.01"
              min="0"
              max="10"
              step="0.01"
              stringMode
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Transfer
            </Button>
          </Form.Item>
        </Form>
      </div>
    </section>
  );
}
